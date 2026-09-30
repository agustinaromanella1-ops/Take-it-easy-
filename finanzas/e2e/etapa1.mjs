/**
 * Prueba de punta a punta de la etapa 1, sobre la app compilada.
 *
 *   npm run build && npx vite preview --port 4174 &
 *   node e2e/etapa1.mjs
 *
 * Corre a 360 px de ancho, con la fecha fija (15 de septiembre de 2026, hora
 * argentina) para que los números sean siempre los mismos. Lee comprobantes
 * con el lector de texto de verdad: las imágenes se dibujan en el momento,
 * son sintéticas y no tienen datos de nadie.
 *
 * Deja capturas en e2e/capturas/.
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

async function contexto(opciones = {}) {
  const ctx = await navegador.newContext({
    viewport: { width: 360, height: 780 },
    deviceScaleFactor: 2,
    locale: 'es-AR',
    timezoneId: 'America/Argentina/Buenos_Aires',
    serviceWorkers: 'block',
    acceptDownloads: true,
    ...opciones,
  });
  // El reloj arranca en la fecha fija pero avanza: los sellos de dos cambios
  // seguidos tienen que ser distintos, como en la vida real.
  await ctx.clock.setSystemTime(opciones.fecha ?? HOY);
  return ctx;
}

/** Ir a una sección desde la barra de abajo. */
const ir = (p, seccion) => p.getByRole('navigation').getByRole('button', { name: seccion, exact: true }).click();
const disponible = (p, m = 'ARS') => p.getByTestId(`disponible-${m}`).innerText();
const datos = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('salchi:datos') ?? 'null'));
const esperarGuardado = (p) => p.waitForTimeout(450);

async function anotarNumero(p, importe) {
  await p.getByRole('button', { name: 'Anotar', exact: true }).click();
  await p.keyboard.type(importe);
  await p.getByRole('button', { name: 'Guardar' }).click();
}

async function anotarFrase(p, frase) {
  await p.getByRole('button', { name: 'Anotar', exact: true }).click();
  await p.getByRole('button', { name: 'Con una frase' }).click();
  await p.getByLabel('Escribilo como te salga').fill(frase);
  await p.getByRole('button', { name: 'Entender' }).click();
  await p.getByRole('button', { name: 'Guardar' }).click();
}

/** Dibuja un ticket en un canvas y lo devuelve como PNG. */
async function imagenTicket(p, lineas, ruido = false) {
  const b64 = await p.evaluate(
    ({ lineas, ruido }) => {
      const c = document.createElement('canvas');
      c.width = 900;
      c.height = 120 + lineas.length * 64;
      const x = c.getContext('2d');
      x.fillStyle = '#fff';
      x.fillRect(0, 0, c.width, c.height);
      if (ruido) {
        for (let i = 0; i < 20000; i++) {
          x.fillStyle = `rgb(${(i * 37) % 255},${(i * 91) % 255},${(i * 53) % 255})`;
          x.fillRect((i * 7919) % 900, (i * 104729) % c.height, 6, 6);
        }
      } else {
        x.fillStyle = '#111';
        x.font = '40px monospace';
        lineas.forEach((l, i) => x.fillText(l, 50, 90 + i * 64));
      }
      return c.toDataURL('image/png').split(',')[1];
    },
    { lineas, ruido },
  );
  return { name: 'comprobante.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') };
}

const pedidosAfuera = [];

// ---------------------------------------------------------------------------
console.log('\nPrimer uso y registro');
const ctx = await contexto();
const p = await ctx.newPage();
const errores = [];
p.on('pageerror', (e) => errores.push(e.message));
p.on('request', (r) => {
  if (!r.url().startsWith(URL) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) pedidosAfuera.push(r.url());
});
await p.goto(URL);

await verificar('arranca vacía de verdad, con bienvenida y sin datos guardados', async () => {
  await p.getByRole('heading', { name: 'Hola. Soy Salchi.' }).waitFor();
  igual(await datos(p), null);
  await p.screenshot({ path: join(DIR, '01-bienvenida.png') });
});

await verificar('onboarding de tres pasos: una cuenta y un compromiso', async () => {
  await p.getByRole('button', { name: 'Empezar' }).click();
  await p.getByLabel('Nombre (opcional)').fill('Banco');
  await p.getByLabel('¿Cuánto hay hoy?').fill('150.000');
  await p.getByRole('button', { name: 'Seguir' }).click();
  await p.getByLabel('Qué es').fill('Alquiler');
  await p.getByLabel('Cuándo vence').fill('2026-09-22');
  await p.getByLabel('Importe (opcional)').fill('90000');
  await p.getByRole('button', { name: 'Seguir' }).click();
  await p.getByRole('button', { name: 'Sí, quedate' }).click();
  // 150.000 − 90.000 del alquiler que vence en el período (hasta fin de mes).
  igual(await disponible(p), '$ 60.000');
  igual(await p.getByTestId('proximo-distancia').innerText(), 'En 7 días');
  await p.screenshot({ path: join(DIR, '02-hoy.png'), fullPage: true });
});

await verificar('anotar un gasto con el teclado: número y Enter, sin tocar nada más', async () => {
  await p.getByRole('button', { name: 'Anotar', exact: true }).click();
  await p.screenshot({ path: join(DIR, '03-anotar.png') });
  await p.keyboard.type('8500');
  await p.keyboard.press('Enter');
  igual(await disponible(p), '$ 51.500');
  const d = await esperarGuardado(p).then(() => datos(p));
  igual(d.movimientos[0].cuentaId, d.cuentas[0].id, 'con una sola cuenta, se elige sola:');
});

await verificar('persiste al cerrar y volver a abrir', async () => {
  await p.reload();
  igual(await disponible(p), '$ 51.500');
});

await verificar('editar un movimiento y deshacer la edición', async () => {
  await ir(p, 'Mi plata');
  await p.locator('.mov').first().click();
  const campo = p.getByLabel('Importe');
  await campo.fill('9000');
  await p.getByRole('button', { name: 'Guardar' }).click();
  await ir(p, 'Hoy');
  igual(await disponible(p), '$ 51.000');
  await p.getByRole('button', { name: 'Deshacer' }).click();
  igual(await disponible(p), '$ 51.500');
});

await verificar('borrar un movimiento y deshacer el borrado, también tras guardar', async () => {
  await ir(p, 'Mi plata');
  await p.locator('.mov').first().click();
  await p.getByRole('button', { name: 'Borrar' }).click();
  await esperarGuardado(p);
  igual((await datos(p)).movimientos.length, 0);
  await p.getByRole('button', { name: 'Deshacer' }).click();
  await esperarGuardado(p);
  igual((await datos(p)).movimientos.length, 1);
  await p.reload();
  await ir(p, 'Hoy');
  igual(await disponible(p), '$ 51.500');
});

await verificar('aviso de posible duplicado, sin borrar nada', async () => {
  await anotarNumero(p, '8500');
  await p.getByText('Se parece a uno que ya anotaste').waitFor();
  await p.getByRole('button', { name: 'No, es el mismo' }).click();
  await esperarGuardado(p);
  igual((await datos(p)).movimientos.length, 1);
});

// ---------------------------------------------------------------------------
console.log('\nCuentas, transferencias, tarjeta y monedas');

async function nuevaCuenta(tipo, nombre, importe, moneda = 'Pesos') {
  await ir(p, 'Mi plata');
  await p.getByRole('button', { name: 'Agregar' }).first().click();
  const cuadro = p.getByRole('dialog');
  await cuadro.getByRole('button', { name: tipo, exact: true }).click();
  await cuadro.getByLabel('Nombre').fill(nombre);
  if (moneda !== 'Pesos') await cuadro.getByRole('button', { name: moneda, exact: true }).click();
  await p.locator('.modal .input-importe').fill(importe);
  await p.getByRole('button', { name: 'Guardar' }).click();
  await ir(p, 'Hoy');
}

await verificar('una transferencia propia no cambia lo disponible', async () => {
  await nuevaCuenta('Efectivo', 'Efectivo', '0');
  const antes = await disponible(p);
  await anotarFrase(p, 'pasé 20000 de banco a efectivo');
  igual(await disponible(p), antes);
  const d = await esperarGuardado(p).then(() => datos(p));
  const t = d.movimientos.find((m) => m.tipo === 'transferencia');
  cierto(t && t.importe === 2_000_000, 'no se guardó la transferencia');
});

await verificar('compra en cuotas: se resta la cuota del resumen del período, no el total', async () => {
  await nuevaCuenta('Tarjeta de crédito', 'Visa', '0');
  await anotarFrase(p, 'zapatillas 30000 en 3 cuotas con visa');
  // El resumen vence el 5/10: fuera del período (hasta el 30/9).
  igual(await disponible(p), '$ 51.500');
  // Con un cobro esperado el 10/10, el período llega hasta ahí y entra una cuota.
  await ir(p, 'Mi plata');
  await p.getByRole('button', { name: 'Agregar' }).nth(2).click();
  await p.getByLabel('Qué es').fill('Sueldo');
  await p.getByLabel('Cuándo creés que entra').fill('2026-10-10');
  await p.getByLabel('Cuánto, más o menos (opcional)').fill('500000');
  await p.getByRole('button', { name: 'Guardar' }).click();
  await ir(p, 'Hoy');
  igual(await disponible(p), '$ 41.500');
  await p.getByText('Si cobrás Sueldo, llegarías a $ 541.500').waitFor();
});

await verificar('pagar el resumen no duplica las compras', async () => {
  await ir(p, 'Mi plata');
  await p.getByRole('button', { name: 'Pagar resumen' }).click();
  await p.getByLabel('Con qué').selectOption({ label: 'Banco' });
  await p.getByRole('dialog').getByRole('button', { name: 'Ya lo pagué' }).click();
  await ir(p, 'Hoy');
  // El banco baja 10.000 y la cuota deja de restarse: queda igual.
  igual(await disponible(p), '$ 41.500');
});

await verificar('la explicación muestra la cuenta renglón por renglón', async () => {
  await p.getByRole('button', { name: '¿Cómo se calcula?' }).click();
  const tabla = await p.locator('.cuenta-tabla').innerText();
  cierto(tabla.includes('Plata en Banco') && tabla.includes('Alquiler') && tabla.includes('Podés usar'), tabla);
  await p.screenshot({ path: join(DIR, '04-explicacion.png') });
  await p.getByRole('button', { name: 'Entendido' }).click();
});

await verificar('pesos y dólares por separado, nunca sumados', async () => {
  await nuevaCuenta('Efectivo', 'Dólares', '100', 'Dólares');
  igual(await disponible(p), '$ 41.500');
  igual(await disponible(p, 'USD'), 'US$ 100');
});

await verificar('un compromiso sin importe no se inventa: se avisa', async () => {
  await ir(p, 'Mi plata');
  await p.getByRole('button', { name: 'Agregar' }).nth(1).click();
  await p.getByLabel('Qué es').fill('Luz');
  await p.getByLabel('Cuándo vence').fill('2026-09-25');
  await p.getByText('Todavía no sé cuánto es').click();
  await p.getByRole('button', { name: 'Guardar' }).click();
  await ir(p, 'Hoy');
  igual(await disponible(p), '$ 41.500');
  await p.getByText('Falta el importe de Luz').waitFor();
});

// ---------------------------------------------------------------------------
console.log('\nComprobantes (lector de texto real, en el dispositivo)');

await verificar('lee un ticket: total, no subtotal ni vuelto, y lo guarda con su origen', async () => {
  await p.getByRole('button', { name: 'Anotar', exact: true }).click();
  await p.getByRole('button', { name: 'Con una foto' }).click();
  const img = await imagenTicket(p, ['KIOSCO LA ESQUINA', 'Fecha: 14/09/2026', 'SUBTOTAL 10.000,00', 'TOTAL $ 12.345,00', 'EFECTIVO 20.000,00', 'VUELTO 7.655,00']);
  await p.getByTestId('elegir-imagen').setInputFiles(img);
  await p.getByRole('button', { name: 'Leer' }).click();
  await p.getByLabel('Importe total').waitFor({ timeout: 90_000 });
  igual(await p.getByLabel('Importe total').inputValue(), '12345');
  igual(await p.getByLabel('Fecha').inputValue(), '2026-09-14');
  await p.screenshot({ path: join(DIR, '05-comprobante.png'), fullPage: true });
  await p.getByRole('button', { name: 'Guardar' }).click();
  const d = await esperarGuardado(p).then(() => datos(p));
  const m = d.movimientos.find((x) => x.origen === 'comprobante');
  cierto(m && m.importe === 1_234_500, 'no se guardó el movimiento del comprobante');
});

await verificar('el mismo comprobante dos veces: avisa del duplicado', async () => {
  await p.getByRole('button', { name: 'Anotar', exact: true }).click();
  await p.getByRole('button', { name: 'Con una foto' }).click();
  const img = await imagenTicket(p, ['KIOSCO LA ESQUINA', 'Fecha: 14/09/2026', 'TOTAL $ 12.345,00']);
  await p.getByTestId('elegir-imagen').setInputFiles(img);
  await p.getByRole('button', { name: 'Leer' }).click();
  await p.getByLabel('Importe total').waitFor({ timeout: 90_000 });
  await p.getByRole('button', { name: 'Guardar' }).click();
  await p.getByText('Parece que ya lo anotaste').waitFor();
  await p.getByRole('button', { name: 'No, es el mismo' }).click();
});

await verificar('una factura se guarda como algo a pagar, no como gasto', async () => {
  await p.getByRole('button', { name: 'Anotar', exact: true }).click();
  await p.getByRole('button', { name: 'Con una foto' }).click();
  const img = await imagenTicket(p, ['AGUAS DEL SUR', 'Factura B 0001-00012345', 'Vencimiento 28/09/2026', 'TOTAL A PAGAR $ 5.000,00']);
  await p.getByTestId('elegir-imagen').setInputFiles(img);
  await p.getByRole('button', { name: 'Leer' }).click();
  await p.getByText('Parece una factura').waitFor({ timeout: 90_000 });
  const movsAntes = (await datos(p)).movimientos.length;
  await p.getByRole('button', { name: 'Guardar' }).click();
  const d = await esperarGuardado(p).then(() => datos(p));
  igual(d.movimientos.length, movsAntes, 'la factura no tiene que crear un gasto:');
  cierto(d.compromisos.some((k) => k.importe === 500_000 && !k.pagado), 'no quedó el compromiso');
});

await verificar('imagen ilegible: lo dice y ofrece recortar, sacar otra o completar a mano', async () => {
  await p.getByRole('button', { name: 'Anotar', exact: true }).click();
  await p.getByRole('button', { name: 'Con una foto' }).click();
  await p.getByTestId('elegir-imagen').setInputFiles(await imagenTicket(p, [], true));
  await p.getByRole('button', { name: 'Leer' }).click();
  await p.getByText('No pude leer esta imagen').waitFor({ timeout: 90_000 });
  await p.getByRole('button', { name: 'Completar a mano' }).click();
  igual(await p.getByLabel('Importe total').inputValue(), '', 'no tiene que inventar un importe:');
  await p.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).click();
});

await verificar('si el lector no carga: mensaje claro y formulario manual', async () => {
  const c2 = await contexto();
  const p2 = await c2.newPage();
  await p2.route('**/ocr/**', (r) => r.fulfill({ status: 404, body: '' }));
  await p2.goto(URL);
  await p2.getByRole('button', { name: 'Mirar primero con datos de ejemplo' }).click();
  await p2.getByRole('button', { name: 'Anotar', exact: true }).click();
  await p2.getByRole('button', { name: 'Con una foto' }).click();
  await p2.getByTestId('elegir-imagen').setInputFiles(await imagenTicket(p2, ['TOTAL 1.000,00']));
  await p2.getByRole('button', { name: 'Leer' }).click();
  await p2.getByText('Podés completarlo a mano mirando la imagen').waitFor({ timeout: 30_000 });
  await p2.getByRole('button', { name: 'Completar a mano' }).click();
  await p2.getByLabel('Importe total').waitFor();
  await c2.close();
});

// ---------------------------------------------------------------------------
console.log('\nHuellitas, compañero y hormiga');

await verificar('la huellita se completa y el perro aprende su primer truco', async () => {
  const d = await datos(p);
  // Anotar, actualizar saldo (al crear cuentas), confirmar compromiso (el
  // resumen) y comprobante ya sumaron. Falta una.
  cierto(d.huellitas.almohadillas >= 3 || d.huellitas.trucos.length > 0, `almohadillas: ${d.huellitas.almohadillas}`);
  if (d.huellitas.trucos.length === 0) {
    await ir(p, 'Mi plata');
    await p.getByRole('button', { name: 'Ya los revisé' }).click();
    await p.getByText(/aprendió un truco/).waitFor();
    await p.waitForTimeout(1500);
    await p.screenshot({ path: join(DIR, '06-celebracion.png') });
  }
  await esperarGuardado(p);
  cierto((await datos(p)).huellitas.trucos.includes('patita'), 'no aprendió la patita');
});

await verificar('anotar diez veces no llena más de una almohadilla', async () => {
  const antes = (await datos(p)).huellitas;
  for (let i = 0; i < 3; i++) {
    await anotarNumero(p, String(100 + i));
  }
  await esperarGuardado(p);
  const despues = (await datos(p)).huellitas;
  igual(despues.totalCompletas, antes.totalCompletas);
  cierto(despues.almohadillas <= antes.almohadillas + 1, 'sumó de más');
});

await verificar('la celebración no tapa botones ni se lleva el foco', async () => {
  await p.evaluate(() => document.querySelector('.boton-anotar')?.focus());
  const ev = await p.evaluate(() => {
    const c = document.createElement('div');
    c.className = 'celebracion';
    document.body.appendChild(c);
    const r = getComputedStyle(c).pointerEvents;
    c.remove();
    return r;
  });
  igual(ev, 'none');
});

await verificar('sin personaje: se va el perro, quedan todas las funciones', async () => {
  await p.getByRole('banner').getByRole('button', { name: 'Ajustes' }).click();
  await p.getByRole('button', { name: 'Sin personaje' }).click();
  await ir(p, 'Hoy');
  igual(await p.locator('.companero').count(), 0);
  await anotarNumero(p, '1');
  await p.getByText('Anotaste un gasto').waitFor();
  await p.getByRole('button', { name: 'Deshacer' }).click();
});

await verificar('los trucos se conservan después de desactivar y de recargar', async () => {
  await p.reload();
  await p.getByRole('banner').getByRole('button', { name: 'Ajustes' }).click();
  await p.getByText(/Trucos aprendidos \(1 de 8\)/).click();
  await p.getByText('aprendido', { exact: true }).waitFor();
  await p.getByRole('button', { name: 'Visible en Hoy' }).click();
});

await verificar('la hormiga aparece, se descarta con "Ahora no" y no insiste', async () => {
  await p.evaluate(() => localStorage.removeItem('salchi:hormiga'));
  await p.reload();
  const boton = p.getByRole('button', { name: /Hormiguita/ });
  await boton.waitFor({ timeout: 8000 });
  await p.screenshot({ path: join(DIR, '07-hormiga.png') });
  await boton.click();
  await p.getByRole('button', { name: 'Ahora no' }).click();
  await p.reload();
  await p.waitForTimeout(5000);
  igual(await boton.count(), 0);
});

await verificar('la hormiga no aparece si se la desactiva', async () => {
  await p.evaluate(() => localStorage.removeItem('salchi:hormiga'));
  await p.getByRole('banner').getByRole('button', { name: 'Ajustes' }).click();
  await p.getByRole('switch', { name: /Hormiguita/ }).uncheck();
  await ir(p, 'Hoy');
  await p.waitForTimeout(5000);
  igual(await p.getByRole('button', { name: /Hormiguita/ }).count(), 0);
});

await verificar('modo baja energía: solo disponible, próximo compromiso y anotar', async () => {
  await p.getByRole('switch', { name: /Modo baja energía/ }).check();
  igual(await p.locator('.companero').count(), 0);
  igual(await p.getByText('Un paso chiquito').count(), 0);
  await p.getByTestId('disponible-ARS').waitFor();
  await p.getByRole('button', { name: 'Anotar', exact: true }).waitFor();
  await p.screenshot({ path: join(DIR, '08-baja-energia.png'), fullPage: true });
  await p.getByRole('switch', { name: /Modo baja energía/ }).uncheck();
});

await verificar('exportar una copia que se vuelve a poder leer', async () => {
  await p.getByRole('banner').getByRole('button', { name: 'Ajustes' }).click();
  const [descarga] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: 'Bajar una copia' }).click()]);
  const copia = JSON.parse(readFileSync(await descarga.path(), 'utf8'));
  cierto(Array.isArray(copia.movimientos) && copia.cuentas.length === 4, 'la copia no tiene los datos');
});

// ---------------------------------------------------------------------------
console.log('\nDatos de ejemplo');

await verificar('los datos de ejemplo no se mezclan ni se guardan', async () => {
  await ir(p, 'Hoy');
  const numeroAntes = await disponible(p);
  await p.getByRole('banner').getByRole('button', { name: 'Ajustes' }).click();
  await esperarGuardado(p);
  const antes = await p.evaluate(() => localStorage.getItem('salchi:datos'));
  await p.getByRole('button', { name: 'Ver con datos de ejemplo' }).click();
  await p.getByText('Estás mirando datos de ejemplo').waitFor();
  await ir(p, 'Hoy');
  await p.screenshot({ path: join(DIR, '09-ejemplo-hoy.png'), fullPage: true });
  await anotarNumero(p, '777');
  await p.waitForTimeout(600);
  const despues = await p.evaluate(() => localStorage.getItem('salchi:datos'));
  igual(despues, antes, 'lo guardado cambió durante el ejemplo:');
  cierto(!despues.includes('ej-banco') && !despues.includes('77700'), 'se filtraron datos de ejemplo');
  await p.getByRole('button', { name: 'Salir del ejemplo' }).click();
  igual(await disponible(p), numeroAntes);
});

// ---------------------------------------------------------------------------
console.log('\nVolver después de una pausa');

await verificar('tras 30 días: recibe sin reproches, pone al día y registra la diferencia', async () => {
  const c3 = await contexto({ fecha: new Date('2026-10-15T12:00:00-03:00') });
  const p3 = await c3.newPage();
  const guardado = await p.evaluate(() => localStorage.getItem('salchi:datos'));
  await p3.goto(URL);
  await p3.evaluate((g) => {
    localStorage.setItem('salchi:datos', g);
    localStorage.setItem('salchi:ultima-visita', '2026-09-15');
  }, guardado);
  await p3.reload();
  await p3.getByRole('heading', { name: 'Hola de nuevo.' }).waitFor();
  const texto = await p3.locator('main').innerText();
  cierto(!/olvidaste|atrasad|otra vez|deberías/i.test(texto), 'hay un reproche en el texto');
  await p3.screenshot({ path: join(DIR, '10-regreso.png') });
  await p3.getByRole('button', { name: 'Poner al día cómo estoy hoy' }).click();
  // Compromisos que vencieron en la pausa.
  await p3.getByRole('heading', { name: /¿Pagaste Alquiler\?/ }).waitFor();
  await p3.getByRole('button', { name: 'Sí, ya lo pagué' }).click();
  while (await p3.getByRole('heading', { name: /¿Pagaste/ }).count()) await p3.getByRole('button', { name: 'No me acuerdo' }).click();
  await p3.getByRole('heading', { name: '¿Cuánto hay hoy en Banco?' }).waitFor();
  await p3.getByLabel('Saldo de hoy').fill('30000');
  await p3.getByText('queda registrada como diferencia sin conciliar').waitFor();
  await p3.getByRole('button', { name: 'Guardar' }).click();
  while (await p3.getByRole('heading', { name: /¿Cuánto hay hoy/ }).count()) await p3.getByRole('button', { name: 'Saltear esta' }).click();
  await p3.getByRole('heading', { name: /Listo por hoy/ }).waitFor();
  await p3.waitForTimeout(450);
  const d = await datos(p3);
  const ajuste = d.movimientos.find((m) => m.tipo === 'ajuste');
  cierto(ajuste && ajuste.categoria === '' && ajuste.nota === 'Diferencia sin conciliar', 'no quedó el ajuste');
  cierto(d.huellitas.trucos.includes('patita'), 'se perdió un truco en la pausa');
  cierto(d.movimientos.length >= (JSON.parse(guardado).movimientos.length), 'se perdió historial');
  await p3.getByRole('button', { name: 'Ir a Hoy' }).click();
  await p3.getByTestId('disponible-ARS').waitFor();
  await c3.close();
});

// ---------------------------------------------------------------------------
console.log('\nAccesibilidad y privacidad');

await verificar('teclado: el cuadro de anotar abre, retiene el foco y lo devuelve al cerrar', async () => {
  await ir(p, 'Hoy');
  await p.locator('.boton-anotar').focus();
  await p.keyboard.press('Enter');
  const enfocado = await p.evaluate(() => document.activeElement?.className);
  cierto(String(enfocado).includes('input-importe'), `el foco quedó en ${enfocado}`);
  await p.keyboard.press('Escape');
  igual(await p.evaluate(() => document.activeElement?.className), 'boton-anotar');
});

await verificar('movimiento reducido: el perro queda quieto', async () => {
  const c4 = await contexto({ reducedMotion: 'reduce' });
  const p4 = await c4.newPage();
  await p4.goto(URL);
  await p4.getByRole('button', { name: 'Mirar primero con datos de ejemplo' }).click();
  // Quieto = el PNG, no el GIF volando.
  const src = await p4.locator('.salchicha img').first().getAttribute('src');
  igual(src, '/pipi-cucu-dog-static.png');
  await c4.close();
});

await verificar('el perro es el mismo archivo que el de Pipí Cucú, byte por byte', async () => {
  const src = await p.locator('.salchicha img').first().getAttribute('src');
  igual(src, '/pipi-cucu-dog-flying.gif');
  for (const archivo of ['pipi-cucu-dog-flying.gif', 'pipi-cucu-dog-static.png']) {
    const servido = Buffer.from(await (await fetch(new globalThis.URL(archivo, URL))).arrayBuffer());
    const original = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', archivo));
    cierto(servido.equals(original), `${archivo} no es igual al de Pipí Cucú`);
  }
});

await verificar('modo oscuro sin letra clara sobre fondo claro', async () => {
  const c5 = await contexto({ colorScheme: 'dark' });
  const p5 = await c5.newPage();
  await p5.goto(URL);
  await p5.getByRole('button', { name: 'Mirar primero con datos de ejemplo' }).click();
  const fondo = await p5.evaluate(() => getComputedStyle(document.body).backgroundColor);
  igual(fondo, 'rgb(18, 26, 23)');
  await p5.screenshot({ path: join(DIR, '11-oscuro-hoy.png'), fullPage: true });
  await ir(p5, 'Mi plata');
  await p5.screenshot({ path: join(DIR, '12-oscuro-mi-plata.png'), fullPage: true });
  await c5.close();
});

await verificar('sin scroll horizontal a 360 px en ninguna sección', async () => {
  for (const s of ['Hoy', 'Mi plata', 'Mis planes', 'Ajustes']) {
    if (s === 'Ajustes') await p.getByRole('banner').getByRole('button', { name: s }).click();
    else await ir(p, s);
    const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
    cierto(ancho <= 360, `${s}: ${ancho}px`);
    await p.screenshot({ path: join(DIR, `13-${s.replace(' ', '-').toLowerCase()}.png`), fullPage: true });
  }
});

await verificar('ningún pedido a otro origen: nada sale del dispositivo', async () => {
  igual(pedidosAfuera.length, 0, pedidosAfuera.join(', '));
});

await verificar('sin errores de JavaScript en la página', async () => {
  igual(errores.length, 0, errores.join(' | '));
});

await navegador.close();
console.log(`\n${ok} de ${ok + fallas.length} verificaciones pasaron.`);
if (fallas.length) {
  console.log('Fallaron:\n - ' + fallas.join('\n - '));
  process.exit(1);
}
