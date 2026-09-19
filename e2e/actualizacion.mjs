/**
 * La barra de "hay una versión nueva", de punta a punta.
 *
 * Esto ya falló dos veces y de dos formas distintas: primero la barra no
 * aparecía nunca (el service worker estaba en 'autoUpdate', que se actualiza
 * solo e ignora el aviso), y después aparecía pero el botón no hacía nada (la
 * librería recarga al recibir un evento que no llega si la pestaña nunca
 * estuvo controlada por un service worker). Ninguna de las dos se ve mirando
 * el código: hay que publicar una versión nueva con la app abierta.
 *
 * Eso es lo que hace esta prueba: compila, abre la app, vuelve a compilar sin
 * recargar la página, y comprueba que el aviso llegue y que el botón termine
 * con la app corriendo la versión nueva de verdad.
 *
 *   npx vite build && npx vite preview --port 4173 &
 *   node e2e/actualizacion.mjs
 */
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';

let ok = 0, fail = 0;
function check(nombre, condicion, detalle = '') {
  if (condicion) { ok++; console.log(`   ✓ ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { fail++; console.log(`   ✗ FALLA: ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
const titulo = (t) => console.log(`\n── ${t} ──`);

const URL = process.env.URL ?? 'http://localhost:4173/';
const browser = await chromium.launch();
const errores = [];

/** El archivo principal que cargó la página. Cambia de nombre en cada versión. */
const bundle = (p) => p.evaluate(() => document.querySelector('script[type=module]')?.getAttribute('src'));

async function abrir(ctx) {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push(e.message));
  await p.goto(URL);
  await pasarPortada(p);
  return p;
}

async function pasarPortada(p) {
  await p.locator('.welcome').waitFor({ state: 'detached', timeout: 8000 }).catch(async () => {
    await p.click('.welcome-cta').catch(() => {});
  });
  await p.locator('.tour-saltar').click().catch(() => {});
}

/** Compila de nuevo: es lo que hace Cloudflare cuando se publica un commit. */
function publicarVersionNueva() {
  execSync('npx vite build', { cwd: process.cwd(), stdio: 'ignore' });
}

/**
 * Corre el recorrido entero. `controlada` dice si antes de publicar la versión
 * nueva la página ya estaba manejada por un service worker: los dos casos
 * pasan de verdad y fallaban distinto.
 */
async function recorrido(controlada) {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 950 } });
  const p = await abrir(ctx);

  if (controlada) {
    // La primera visita instala el service worker pero no toma el control de
    // la página que ya está abierta; recién manda desde la carga siguiente.
    await p.waitForTimeout(2500);
    await p.reload();
    await pasarPortada(p);
    const manda = await p
      .waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 20000 })
      .then(() => true)
      .catch(() => false);
    check('el service worker toma el control en la segunda carga', manda);
  }

  check('al abrir no hay barra de actualizar', (await p.locator('.update-bar').count()) === 0);

  const antes = await bundle(p);
  publicarVersionNueva();

  await p.locator('.tabbar button', { hasText: 'Ajustes' }).click();
  await p.waitForTimeout(400);
  const tarjeta = p.locator('.card').filter({ hasText: 'Versión' });
  check('Ajustes dice de cuándo es esta copia', (await tarjeta.locator('p').first().innerText()).includes('Esta copia es del'));

  await p.getByRole('button', { name: 'Buscar una versión nueva' }).click();
  await p.waitForTimeout(2500);
  check('el botón contesta que hay una nueva', (await tarjeta.locator('p').last().innerText()).includes('versión nueva'));

  const aparecio = await p.waitForSelector('.update-bar', { timeout: 20000 }).then(() => true).catch(() => false);
  check('aparece la barra', aparecio);

  let recargas = 0;
  p.on('framenavigated', (f) => { if (f === p.mainFrame()) recargas++; });
  await p.locator('.update-bar button').click();
  await p.waitForTimeout(6000);
  await pasarPortada(p);

  const despues = await bundle(p);
  check('tocar "Actualizar" deja la app en la versión nueva', antes !== despues, `${antes} → ${despues}`);
  check('y recarga una sola vez', recargas === 1, `recargó ${recargas} vez/veces`);
  check('la barra no queda colgada', (await p.locator('.update-bar').count()) === 0);

  await ctx.close();
}

titulo('1. La pestaña nunca estuvo controlada (primera visita)');
await recorrido(false);

titulo('2. La app ya venía en uso (el caso de todos los días)');
await recorrido(true);

console.log(`\n═══ ${ok} verificaciones pasaron, ${fail} fallaron ═══`);
console.log('Errores de JavaScript:', errores.length ? errores.join(' | ') : 'ninguno');
await browser.close();
process.exit(fail > 0 ? 1 : 0);
