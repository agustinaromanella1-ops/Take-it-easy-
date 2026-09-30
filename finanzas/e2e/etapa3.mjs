/**
 * Prueba de punta a punta de la etapa 3: plan del mes, inversión educativa y
 * compartir con una persona de confianza.
 *
 * Levanta sola dos servidores locales sobre la app compilada: uno con el
 * servicio para compartir y otro sin configurar.
 *
 *   npm run build && node e2e/etapa3.mjs
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const DIR = join(AQUI, 'capturas');
mkdirSync(DIR, { recursive: true });
const HOY = new Date('2026-09-15T12:00:00-03:00');
const CON = 'http://localhost:4175';
const SIN = 'http://localhost:4176';

const servidores = [
  spawn('node', [join(AQUI, '..', 'scripts', 'servidor-local.mjs'), '--puerto', '4175', '--ver-almacen'], { stdio: 'ignore' }),
  spawn('node', [join(AQUI, '..', 'scripts', 'servidor-local.mjs'), '--puerto', '4176', '--sin-almacen'], { stdio: 'ignore' }),
];
await new Promise((r) => setTimeout(r, 1200));

let ok = 0;
const fallas = [];
let actual = null;
async function verificar(nombre, fn) {
  try {
    await fn();
    ok++;
    console.log(`  ✓ ${nombre}`);
  } catch (e) {
    fallas.push(nombre);
    await actual?.screenshot({ path: join(DIR, `falla3-${fallas.length}.png`), fullPage: true }).catch(() => {});
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
const errores = [];
async function pagina(origen) {
  const ctx = await navegador.newContext({
    viewport: { width: 360, height: 780 },
    deviceScaleFactor: 2,
    locale: 'es-AR',
    timezoneId: 'America/Argentina/Buenos_Aires',
    serviceWorkers: 'block',
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  await ctx.clock.setSystemTime(HOY);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push(e.message));
  p.on('request', (r) => {
    const u = r.url();
    if (!u.startsWith(origen) && !u.startsWith('data:') && !u.startsWith('blob:')) errores.push(`pedido afuera: ${u}`);
  });
  return p;
}

const ir = (p, s) => p.getByRole('navigation').getByRole('button', { name: s, exact: true }).click();
const ajustes = (p) => p.getByRole('banner').getByRole('button', { name: 'Ajustes' }).click();
const cuadro = (p) => p.getByRole('dialog');

// Quien comparte: una cuenta de 200.000 y el alquiler de 90.000.
const duena = await pagina(CON);
actual = duena;
await duena.goto(CON);
await duena.getByRole('button', { name: 'Empezar' }).click();
await duena.getByLabel('Nombre (opcional)').fill('Banco');
await duena.getByLabel('¿Cuánto hay hoy?').fill('200000');
await duena.getByRole('button', { name: 'Seguir' }).click();
await duena.getByLabel('Qué es').fill('Alquiler');
await duena.getByLabel('Cuándo vence').fill('2026-09-22');
await duena.getByLabel('Importe (opcional)').fill('90000');
await duena.getByRole('button', { name: 'Seguir' }).click();
await duena.getByRole('button', { name: 'Sí, quedate' }).click();
await duena.getByRole('button', { name: 'Anotar', exact: true }).click();
await duena.keyboard.type('5000');
await cuadro(duena).getByText('Más detalles (opcional)').click();
await cuadro(duena).getByRole('textbox', { name: 'Nota' }).fill('regalo sorpresa para Juli');
await cuadro(duena).getByRole('button', { name: 'Guardar' }).click();

// ---------------------------------------------------------------------------
console.log('\nPlan del mes y metas');

await verificar('el plan muestra entradas, fijas y día a día; lo escrito pisa al promedio', async () => {
  await ir(duena, 'Mis planes');
  await duena.getByText(/^(Ver el plan|Quedan unos|Con lo que sabemos)/).click();
  await duena.getByText('Alquiler').first().waitFor();
  await duena.getByRole('button', { name: 'Cambiar el día a día' }).click();
  await duena.getByLabel(/Día a día por mes/).fill('100000');
  await duena.getByRole('button', { name: 'Usar este número' }).click();
  // Sin cobros: 0 − 90.000 − 100.000.
  igual(await duena.getByTestId('margen').innerText(), '−$ 190.000');
  await duena.getByText('El plan se puede ajustar').waitFor();
  await duena.screenshot({ path: join(DIR, '30-plan.png'), fullPage: true });
});

await verificar('una meta dice cuándo se llega al ritmo real de aportes, sin inventarlo', async () => {
  await duena.getByRole('button', { name: 'Crear una meta' }).click();
  await cuadro(duena).getByLabel('Nombre').fill('Bici');
  await cuadro(duena).getByLabel('Cuánto necesitás (opcional)').fill('300000');
  await cuadro(duena).getByRole('button', { name: 'Guardar' }).click();
  igual(await duena.getByText(/llegarías en/).count(), 0, 'sin aportes no debería haber pronóstico:');
  await duena.getByRole('button', { name: 'Apartar', exact: true }).click();
  await cuadro(duena).getByLabel('Cuánto').fill('90000');
  await cuadro(duena).getByRole('button', { name: 'Apartar', exact: true }).click();
  await duena.getByText(/llegarías en 7 meses/).waitFor();
});

// ---------------------------------------------------------------------------
console.log('\nInversión educativa');

await verificar('antes de empezar: mira la reserva y responde según las respuestas, sin recomendar', async () => {
  await duena.getByRole('button', { name: 'Abrir' }).click();
  await cuadro(duena).getByText('Todavía no armaste una reserva').waitFor();
  await cuadro(duena).getByRole('button', { name: 'Menos de un año' }).click();
  await cuadro(duena).getByText(/importa más poder sacarla rápido/).waitFor();
  await cuadro(duena).getByRole('button', { name: 'La sacaría toda' }).click();
  await cuadro(duena).getByText(/Vender en plena caída/).waitFor();
  const texto = await cuadro(duena).innerText();
  cierto(!/te recomendamos|deberías invertir|compr[aá] /i.test(texto), 'suena a recomendación');
});

await verificar('el simulador muestra pesos de hoy y el peor momento, también con una caída', async () => {
  await cuadro(duena).getByRole('button', { name: 'Simular' }).click();
  await cuadro(duena).getByText('no son pronósticos').waitFor();
  const mal = await cuadro(duena).getByTestId('escenario-0').innerText();
  cierto(/en pesos de hoy/.test(mal) && /En el peor momento/.test(mal), mal);
  cierto(/En ningún mes hubo menos/.test(await cuadro(duena).getByTestId('escenario-2').innerText()), 'el bueno no debería tener pérdida');
  await cuadro(duena).getByRole('switch', { name: /Simular una caída/ }).check();
  cierto(/En el peor momento \(mes 3\)/.test(await cuadro(duena).getByTestId('escenario-2').innerText()), 'la caída no se ve');
  await duena.screenshot({ path: join(DIR, '31-simulador.png'), fullPage: true });
});

await verificar('el glosario incluye señales de estafa', async () => {
  await cuadro(duena).getByRole('button', { name: 'Palabras' }).click();
  await cuadro(duena).getByText('Señales de estafa').waitFor();
  await cuadro(duena).getByRole('button', { name: 'Cerrar', exact: true }).click();
});

// ---------------------------------------------------------------------------
console.log('\nCompartir con alguien de confianza');

let enlace = '';
await verificar('crear un enlace con solo lo elegido', async () => {
  await ajustes(duena);
  await duena.getByRole('button', { name: 'Compartir', exact: true }).click();
  await cuadro(duena).getByLabel(/Con quién/).fill('Mi hermana');
  await cuadro(duena).getByRole('button', { name: 'Crear enlace' }).click();
  enlace = await cuadro(duena).getByTestId('enlace-nuevo').innerText();
  cierto(/\/ver#[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}$/.test(enlace), enlace);
  await duena.screenshot({ path: join(DIR, '32-compartir.png'), fullPage: true });
});

await verificar('el servidor guarda algo que no puede leer', async () => {
  const guardado = await (await fetch(`${CON}/__almacen`)).text();
  cierto(guardado.length > 50, 'no se guardó nada');
  for (const palabra of ['Alquiler', 'Banco', '90000', '9000000', 'Mi hermana', 'regalo']) {
    cierto(!guardado.includes(palabra), `el servidor tiene "${palabra}" en claro`);
  }
  const clave = enlace.split('.').pop();
  cierto(!guardado.includes(clave), 'el servidor tiene la clave');
});

const ayudante = await pagina(CON);
await verificar('la otra persona ve solo lo compartido, de solo lectura, sin tocar su propio navegador', async () => {
  actual = ayudante;
  await ayudante.goto(enlace);
  await ayudante.getByRole('heading', { name: 'Lo que te compartieron' }).waitFor();
  await ayudante.getByText('Alquiler').waitFor();
  igual(await ayudante.getByText('Movimientos de los últimos 30 días').count(), 0, 'se ven movimientos sin permiso:');
  igual(await ayudante.getByText('regalo sorpresa').count(), 0, 'se ve una nota:');
  igual(await ayudante.getByRole('button').count(), 0, 'hay botones en una vista de solo lectura:');
  igual(await ayudante.evaluate(() => localStorage.getItem('salchi:datos')), null, 'escribió en el navegador de quien mira:');
  await ayudante.screenshot({ path: join(DIR, '33-vista-compartida.png'), fullPage: true });
});

await verificar('"Mostrarle lo de hoy" actualiza lo que ve', async () => {
  actual = ayudante;
  const antes = await ayudante.locator('.disponible-numero').first().innerText();
  actual = duena;
  await cuadro(duena).getByRole('button', { name: 'Cerrar', exact: true }).click();
  await duena.getByRole('button', { name: 'Anotar', exact: true }).click();
  await duena.keyboard.type('20000');
  await cuadro(duena).getByRole('button', { name: 'Guardar' }).click();
  await ajustes(duena);
  await duena.getByRole('button', { name: 'Compartir', exact: true }).click();
  await cuadro(duena).getByRole('button', { name: 'Mostrarle lo de hoy' }).click();
  await cuadro(duena).getByText('Mi hermana ve lo de hoy').waitFor();
  actual = ayudante;
  await ayudante.reload();
  await ayudante.getByRole('heading', { name: 'Lo que te compartieron' }).waitFor();
  const despues = await ayudante.locator('.disponible-numero').first().innerText();
  cierto(antes !== despues, `sigue igual: ${despues}`);
});

await verificar('con la clave equivocada no se puede abrir', async () => {
  actual = ayudante;
  await ayudante.goto(enlace.replace(/\.[A-Za-z0-9_-]+$/, '.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'));
  await ayudante.getByRole('heading', { name: 'No se pudo abrir' }).waitFor();
});

await verificar('dejar de compartir corta el enlace', async () => {
  actual = duena;
  await cuadro(duena).getByRole('button', { name: 'Dejar de compartir' }).click();
  await cuadro(duena).getByText('ya no funciona').waitFor();
  actual = ayudante;
  await ayudante.goto(enlace);
  await ayudante.getByRole('heading', { name: 'Este enlace ya no está disponible' }).waitFor();
  const guardado = await (await fetch(`${CON}/__almacen`)).json();
  igual(guardado.length, 0, 'quedó algo guardado:');
});

await verificar('sin el servicio configurado, lo dice y el resto sigue andando', async () => {
  const p = await pagina(SIN);
  actual = p;
  await p.goto(SIN);
  await p.getByRole('button', { name: 'Mirar primero con datos de ejemplo' }).click();
  await p.getByRole('button', { name: 'Salir del ejemplo' }).click();
  await p.goto(SIN);
  await p.getByRole('button', { name: 'Empezar' }).click();
  await p.getByLabel('¿Cuánto hay hoy?').fill('1000');
  await p.getByRole('button', { name: 'Seguir' }).click();
  await p.getByRole('button', { name: 'Saltear' }).click();
  await p.getByRole('button', { name: 'Sin personaje' }).click();
  await ajustes(p);
  await p.getByRole('button', { name: 'Compartir', exact: true }).click();
  await cuadro(p).getByText('no está configurado en este servidor').waitFor();
  igual(await cuadro(p).getByRole('button', { name: 'Crear enlace' }).count(), 0);
});

await verificar('la política de privacidad está y dice las dos excepciones', async () => {
  actual = duena;
  await duena.goto(`${CON}/privacidad.html`);
  await duena.getByRole('heading', { name: 'Privacidad' }).waitFor();
  await duena.getByText('Dictado por voz.').waitFor();
  await duena.getByText('Compartir con alguien de confianza.').waitFor();
});

await verificar('sin pedidos a otros orígenes ni errores de JavaScript', async () => igual(errores.length, 0, errores.join(' | ')));

await navegador.close();
for (const s of servidores) s.kill();
console.log(`\n${ok} de ${ok + fallas.length} verificaciones pasaron.`);
if (fallas.length) {
  console.log('Fallaron:\n - ' + fallas.join('\n - '));
  process.exit(1);
}
