/**
 * Prueba de punta a punta de la etapa 2, sobre la app compilada.
 *
 *   npm run build && npx vite preview --port 4174 &
 *   node e2e/etapa2.mjs
 *
 * Mismas condiciones que la etapa 1: 360 px, fecha fija (15/9/2026, hora
 * argentina) con el reloj avanzando, y el lector de texto de verdad.
 */
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const URL = process.env.URL ?? 'http://localhost:4174/';
const DIR = join(dirname(fileURLToPath(import.meta.url)), 'capturas');
mkdirSync(DIR, { recursive: true });
const HOY = new Date('2026-09-15T12:00:00-03:00');

let ok = 0;
const fallas = [];
async function verificar(nombre, fn) {
  try {
    await fn();
    ok++;
    console.log(`  ✓ ${nombre}`);
  } catch (e) {
    fallas.push(nombre);
    await p.screenshot({ path: join(DIR, `falla-${fallas.length}.png`), fullPage: true }).catch(() => {});
    console.log(`  ✗ ${nombre}\n      ${String(e.message ?? e).split('\n')[0]}`);
  }
}
function igual(a, b, msg = '') {
  if (a !== b) throw new Error(`${msg} esperaba ${JSON.stringify(b)} y fue ${JSON.stringify(a)}`);
}
function cierto(v, msg) {
  if (!v) throw new Error(msg);
}

const navegador = await chromium.launch();
const ctx = await navegador.newContext({
  viewport: { width: 360, height: 780 },
  deviceScaleFactor: 2,
  locale: 'es-AR',
  timezoneId: 'America/Argentina/Buenos_Aires',
  serviceWorkers: 'block',
  acceptDownloads: true,
});
await ctx.clock.setSystemTime(HOY);
const p = await ctx.newPage();
const errores = [];
const afuera = [];
p.on('pageerror', (e) => errores.push(e.message));
p.on('request', (r) => {
  const u = r.url();
  if (!u.startsWith(URL) && !u.startsWith('data:') && !u.startsWith('blob:')) afuera.push(u);
});

const ir = (seccion) => p.getByRole('navigation').getByRole('button', { name: seccion, exact: true }).click();
const ajustes = () => p.getByRole('banner').getByRole('button', { name: 'Ajustes' }).click();
const cuadro = () => p.getByRole('dialog');
const disponible = () => p.getByTestId('disponible-ARS').innerText();
const datos = async () => {
  await p.waitForTimeout(450);
  return p.evaluate(() => JSON.parse(localStorage.getItem('salchi:datos') ?? 'null'));
};
const sinScroll = async (donde) => {
  const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
  cierto(ancho <= 360, `${donde}: ${ancho}px de ancho`);
};

async function imagen(lineas) {
  const b64 = await p.evaluate((lineas) => {
    const c = document.createElement('canvas');
    c.width = 900;
    c.height = 120 + lineas.length * 64;
    const x = c.getContext('2d');
    x.fillStyle = '#fff';
    x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = '#111';
    x.font = '40px monospace';
    lineas.forEach((l, i) => x.fillText(l, 40, 90 + i * 64));
    return c.toDataURL('image/png').split(',')[1];
  }, lineas);
  return { name: 'captura.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') };
}

// Primer uso rápido: una cuenta de 300.000 y nada que venza.
await p.goto(URL);
await p.getByRole('button', { name: 'Empezar' }).click();
await p.getByLabel('Nombre (opcional)').fill('Banco');
await p.getByLabel('¿Cuánto hay hoy?').fill('300000');
await p.getByRole('button', { name: 'Seguir' }).click();
await p.getByRole('button', { name: 'Saltear' }).click();
await p.getByRole('button', { name: 'Sí, quedate' }).click();

// ---------------------------------------------------------------------------
console.log('\nPréstamos y escenarios');

await verificar('un préstamo se carga como deuda y su cuota aparece en lo que vence y en lo disponible', async () => {
  igual(await disponible(), '$ 300.000');
  await ir('Mis planes');
  await p.getByRole('button', { name: 'Agregar un préstamo' }).click();
  await cuadro().getByLabel('Nombre').fill('Préstamo personal');
  await cuadro().locator('.input-importe').first().fill('600000');
  await cuadro().getByLabel('Cuota de cada mes').fill('55000');
  await cuadro().getByLabel('Vence el día').fill('25');
  await cuadro().getByLabel('Tasa nominal anual, % (opcional)').fill('69');
  await cuadro().getByRole('button', { name: 'Guardar' }).click();
  await ir('Hoy');
  // El préstamo no suma como plata; la cuota del 25/9 entra en el período.
  igual(await disponible(), '$ 245.000');
  await p.getByText('Cuota de Préstamo personal').first().waitFor();
});

await verificar('pagar la cuota baja el banco y la deuda, sin contarse dos veces', async () => {
  await p.getByRole('button', { name: 'Ya lo pagué' }).click();
  await cuadro().getByLabel('Con qué').selectOption({ label: 'Banco' });
  await cuadro().getByRole('button', { name: 'Ya lo pagué' }).click();
  igual(await disponible(), '$ 245.000');
  const d = await datos();
  const pago = d.movimientos.find((m) => m.tipo === 'pago-tarjeta');
  cierto(pago && pago.importe === 5_500_000, 'no se registró el pago de la cuota');
});

await verificar('escenarios: plazo e intereses con supuestos a la vista, y aviso si el pago no alcanza', async () => {
  await ir('Mis planes');
  await p.getByRole('button', { name: 'Ver escenarios' }).click();
  await cuadro().getByText(/Terminás en \d+ meses/).first().waitFor();
  await cuadro().getByText('La tasa se mantiene igual todo el tiempo.').waitFor();
  await cuadro().getByLabel('Escenario 1: pago por mes').fill('10000');
  await cuadro().getByText('Con ese pago la deuda no baja').waitFor();
  await sinScroll('escenarios');
  await p.screenshot({ path: join(DIR, '20-escenarios.png'), fullPage: true });
  await cuadro().getByRole('button', { name: 'Listo' }).click();
});

// ---------------------------------------------------------------------------
console.log('\nImportar un CSV');

const csv = `Fecha;Concepto;Débito;Crédito;Saldo
10/09/2026;COTO SUPERMERCADO;8.500,00;;291.500,00
11/09/2026;TRANSFERENCIA A CVU;20.000,00;;271.500,00
12/09/2026;HONORARIOS CLIENTE;;150.000,00;421.500,00
fila rota;;;;
13/09/2026;FARMACIA;3.200,50;;418.299,50
`;

await verificar('lee el archivo, adivina columnas, marca repetidos y todo entra "para revisar"', async () => {
  // Un gasto ya anotado que el CSV también trae.
  await p.getByRole('button', { name: 'Anotar', exact: true }).click();
  await p.keyboard.type('3200,50');
  await cuadro().getByText('Más detalles (opcional)').click();
  await cuadro().getByLabel('Fecha').fill('2026-09-13');
  await cuadro().getByLabel('Dónde o a quién').fill('Farmacia');
  await cuadro().getByRole('button', { name: 'Guardar' }).click();

  await ir('Mi plata');
  await p.getByRole('button', { name: 'Importar un archivo del banco' }).click();
  await cuadro().locator('input[type=file]').setInputFiles({ name: 'banco.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'latin1') });
  await cuadro().getByRole('button', { name: 'Seguir' }).click();
  await cuadro().getByText('Con estas columnas salen 4 movimientos y se saltean 1').waitFor();
  await cuadro().getByRole('button', { name: 'Ver los movimientos' }).click();
  await cuadro().getByText('parece repetido').waitFor();
  await cuadro().getByText('¿entre tus cuentas?').waitFor();
  await sinScroll('importar');
  await p.screenshot({ path: join(DIR, '21-importar.png'), fullPage: true });
  // El repetido viene destildado: importa 3.
  await cuadro().getByRole('button', { name: 'Importar 3' }).click();
  const d = await datos();
  const importados = d.movimientos.filter((m) => m.origen === 'importado');
  igual(importados.length, 3);
  cierto(importados.every((m) => m.aRevisar), 'no quedaron para revisar');
  cierto(!d.movimientos.some((m) => m.importe === 29_150_000), 'se usó el saldo como importe');
});

await verificar('deshacer se lleva la importación entera', async () => {
  await p.getByRole('button', { name: 'Deshacer' }).click();
  const d = await datos();
  igual(d.movimientos.filter((m) => m.origen === 'importado').length, 0);
});

// ---------------------------------------------------------------------------
console.log('\nCaptura con varios movimientos (lector real)');

await verificar('lee una lista de actividad, ignora el saldo y pregunta el signo que falta', async () => {
  await p.getByRole('button', { name: 'Anotar', exact: true }).click();
  await cuadro().getByRole('button', { name: 'Con una foto' }).click();
  await cuadro()
    .getByTestId('elegir-imagen')
    .setInputFiles(await imagen(['Tu saldo $ 250.000', 'Hoy', 'Verduleria  - $ 4.300', 'Cobro de Juan  + $ 12.000', 'Ayer', 'Kiosco  $ 900']));
  await cuadro().getByRole('button', { name: 'Leer' }).click();
  await cuadro().getByText(/Encontré 3 movimientos/).waitFor({ timeout: 90_000 });
  await cuadro().getByText('Revisá esto').waitFor();
  await p.screenshot({ path: join(DIR, '22-captura-varios.png'), fullPage: true });
  await cuadro().getByRole('button', { name: 'Guardar 3' }).click();
  const d = await datos();
  const deCaptura = d.movimientos.filter((m) => m.nota === 'De una captura');
  igual(deCaptura.length, 3);
  cierto(deCaptura.some((m) => m.tipo === 'ingreso' && m.importe === 1_200_000), 'el cobro no quedó como ingreso');
  cierto(!deCaptura.some((m) => m.importe === 25_000_000), 'tomó el saldo');
});

// ---------------------------------------------------------------------------
console.log('\nTarjeta: cuotas y resumen');

const resumen = `RESUMEN VISA
Cierre actual 25/09/26 Vencimiento actual 06/10/26
SU PAGO EN PESOS -0,00
12/09/26 ZAPATILLAS C.01/03 30.000,00
14/09/26 SUPERMERCADO COTO 8.500,00
02/08/26 HELADERA C.02/06 40.000,00
INTERESES FINANCIACION 1.000,00
SALDO ACTUAL $ 79.500,00
PAGO MINIMO $ 12.000,00`;

await verificar('las compras en cuotas se ven por tarjeta', async () => {
  await ir('Mi plata');
  await p.getByRole('button', { name: 'Agregar' }).first().click();
  await cuadro().getByRole('button', { name: 'Tarjeta de crédito', exact: true }).click();
  await cuadro().getByLabel('Nombre').fill('Visa');
  await cuadro().locator('.input-importe').first().fill('0');
  await cuadro().getByRole('button', { name: 'Guardar' }).click();
  await p.getByRole('button', { name: 'Anotar', exact: true }).click();
  await cuadro().getByRole('button', { name: 'Con una frase' }).click();
  await cuadro().getByLabel('Escribilo como te salga').fill('zapatillas 90000 en 3 cuotas con visa');
  await cuadro().getByRole('button', { name: 'Entender' }).click();
  await cuadro().getByRole('button', { name: 'Guardar' }).click();
  await ir('Mi plata');
  await p.getByText('Compras en cuotas (1)').click();
  await p.getByText('Cuota 1 de 3 en el próximo resumen').waitFor();
});

await verificar('el resumen pegado muestra la diferencia y de dónde sale', async () => {
  await p.getByRole('button', { name: 'Revisar con el resumen' }).click();
  await cuadro().getByLabel('Texto del resumen').fill(resumen);
  await cuadro().getByRole('button', { name: 'Leer el texto' }).click();
  igual(await cuadro().getByTestId('diferencia').innerText(), '$ 49.500');
  await cuadro().getByText('SUPERMERCADO COTO').waitFor();
  await cuadro().getByText(/cuota 2 de 6: se agregan las 5 que quedan/).waitFor();
  await cuadro().getByText('Intereses, impuestos y cargos').waitFor();
  await sinScroll('resumen');
  await p.screenshot({ path: join(DIR, '23-resumen.png'), fullPage: true });
  await cuadro().getByRole('button', { name: 'Guardar' }).click();
});

await verificar('después de guardar, el mismo resumen coincide', async () => {
  await p.getByRole('button', { name: 'Revisar con el resumen' }).click();
  await cuadro().getByLabel('Texto del resumen').fill(resumen);
  await cuadro().getByRole('button', { name: 'Leer el texto' }).click();
  await cuadro().getByText('Coincide con lo que anotaste.').waitFor();
  await cuadro().getByRole('button', { name: 'Listo' }).click();
  const d = await datos();
  const heladera = d.movimientos.find((m) => m.comercio.includes('HELADERA'));
  cierto(heladera && heladera.cuotas === 5 && heladera.importe === 20_000_000, 'la heladera no quedó como 5 cuotas');
});

// ---------------------------------------------------------------------------
console.log('\nAccesos rápidos, recordatorios, voz y trucos');

await verificar('el atajo del ícono abre Anotar directo, y la dirección queda limpia', async () => {
  await p.goto(`${URL}?accion=anotar`);
  await cuadro().getByRole('heading', { name: 'Anotar' }).waitFor();
  igual(new globalThis.URL(p.url()).search, '');
  await p.keyboard.press('Escape');
});

await verificar('compartir un texto hacia la app lo entiende y lo muestra antes de guardar', async () => {
  await p.goto(`${URL}?texto=${encodeURIComponent('Pagaste $ 2.500 en Kiosco Pepe con débito')}`);
  await cuadro().getByText(/Entendí: .*\$ 2\.500/).waitFor();
  igual(await cuadro().getByLabel('Importe').inputValue(), '2500');
  await p.keyboard.press('Escape');
});

await verificar('el manifiesto trae atajos y "compartir"', async () => {
  const m = await p.evaluate(async () => (await fetch('/manifest.webmanifest')).json());
  igual(m.shortcuts.length, 3);
  igual(m.share_target.params.text, 'texto');
});

await verificar('todos los vencimientos al calendario en un archivo, sin importes', async () => {
  await ajustes();
  const [d] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: 'Todos los vencimientos al calendario' }).click()]);
  const ics = readFileSync(await d.path(), 'utf8');
  cierto((ics.match(/BEGIN:VEVENT/g) ?? []).length >= 2, 'faltan eventos');
  cierto(!/\d\.\d{3}/.test(ics), 'aparece un importe');
});

await verificar('un recordatorio semanal para mirar la plata', async () => {
  await p.getByRole('combobox', { name: /^Día/ }).selectOption({ label: 'Domingo' });
  await p.getByLabel('Hora').fill('20:00');
  const [d] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: 'Agregar al calendario' }).click()]);
  const ics = readFileSync(await d.path(), 'utf8');
  cierto(ics.includes('RRULE:FREQ=WEEKLY;BYDAY=SU') && ics.includes('T200000'), ics);
});

await verificar('el dictado viene apagado, y al prenderlo aparece "Dictar"', async () => {
  const llave = p.getByRole('switch', { name: /Dictar por voz/ });
  if ((await llave.count()) === 0) {
    await p.getByText('Este navegador no permite dictar').waitFor();
    return;
  }
  cierto(!(await llave.isChecked()), 'venía prendido');
  await llave.check();
  await p.getByRole('button', { name: 'Anotar', exact: true }).click();
  await cuadro().getByRole('button', { name: 'Con una frase' }).click();
  await cuadro().getByRole('button', { name: 'Dictar' }).waitFor();
  await p.keyboard.press('Escape');
  await ajustes();
  await llave.uncheck();
});

await verificar('ocho trucos, y los aprendidos se pueden volver a ver', async () => {
  const d = await datos();
  await p.getByText(/Trucos aprendidos \(\d+ de 8\)/).click();
  if (d.huellitas.trucos.length > 0) {
    await p.getByRole('button', { name: 'Verlo' }).first().click();
    await p.locator('.celebracion-texto').waitFor();
  }
});

await verificar('datos de ejemplo con préstamo, sin romper nada', async () => {
  await p.getByRole('button', { name: 'Ver con datos de ejemplo' }).click();
  await ir('Mis planes');
  await p.getByText('Préstamo personal').first().waitFor();
  await p.screenshot({ path: join(DIR, '24-mis-planes-ejemplo.png'), fullPage: true });
  await sinScroll('mis planes');
  await p.getByRole('button', { name: 'Salir del ejemplo' }).click();
});

await verificar('ningún pedido a otro origen', async () => igual(afuera.length, 0, afuera.join(', ')));
await verificar('sin errores de JavaScript', async () => igual(errores.length, 0, errores.join(' | ')));

await navegador.close();
console.log(`\n${ok} de ${ok + fallas.length} verificaciones pasaron.`);
if (fallas.length) {
  console.log('Fallaron:\n - ' + fallas.join('\n - '));
  process.exit(1);
}
