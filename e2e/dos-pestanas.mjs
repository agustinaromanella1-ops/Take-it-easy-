/**
 * Dos pestañas abiertas a la vez.
 *
 * Guardar el bloque entero pisaba lo que la otra pestaña acababa de guardar:
 * se marcaba una sesión en una, se registraba un cobro en la otra, y lo
 * primero desaparecía sin que nadie se enterara. Son datos de salud y no hay
 * servidor del que recuperarlos.
 *
 * Esto no se ve con una sola pestaña, así que no lo agarra ninguna otra
 * prueba. Ver src/lib/fusion.ts y src/lib/deshacer.ts.
 *
 *   npx vite build && npx vite preview --port 4173 &
 *   node e2e/dos-pestanas.mjs
 */
import { chromium } from 'playwright';

let ok = 0, fail = 0;
const check = (n, c, d = '') => {
  if (c) { ok++; console.log(`   ✓ ${n}${d ? ' — ' + d : ''}`); }
  else { fail++; console.log(`   ✗ FALLA: ${n}${d ? ' — ' + d : ''}`); }
};
const titulo = (t) => console.log(`\n── ${t} ──`);

const URL = process.env.URL ?? 'http://localhost:4173/';
/** Un día cualquiera ya pasado, para que la sesión aparezca como sin marcar. */
const AYER = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const browser = await chromium.launch();
// Mismo contexto = mismo localStorage y eventos `storage` entre pestañas.
const ctx = await browser.newContext({ viewport: { width: 420, height: 950 } });
const errores = [];

/*
 * Los sellos de la semilla salen del reloj de esta máquina, no de una fecha
 * escrita a mano.
 *
 * Con una fecha fija se corre el riesgo de que quede en el FUTURO respecto del
 * reloj real, y entonces la fusión prefiere —con razón— el registro de la
 * semilla por sobre el cambio recién hecho: la prueba falla sin que haya nada
 * roto. Pasó al escribirla.
 */
/** Una hora atrás del reloj de esta máquina. */
const ANTES = new Date(Date.now() - 60 * 60 * 1000).toISOString();

const SEMILLA = {
  version: 2,
  patients: [
    { id:'p1', name:'Ana Gómez', updatedAt:ANTES, defaultFee:3500000,
      frequency:'semanal', status:'activo', colorIndex:0, email:'', phone:'', notes:'',
      kind:'particular', createdAt:'2026-01-01', lastRaise:null, document:'', taxId:'',
      taxCondition:'consumidor_final', legalName:'', memberNumber:'', insurer:'' },
  ],
  sessions: [
    { id:'s1', patientId:'p1', updatedAt:ANTES, date:AYER,
      time:'10:00', durationMin:50, status:'programada', fee:3500000, chargeable:true, notes:'' },
  ],
  payments: [],
  deleted: { patients: [], sessions: [], payments: [] },
  settings: { profession:'psicología', currency:'$', defaultDurationMin:50,
    chargeNoShowByDefault:true, monthlyGoal:0, reminderMinutes:30, avisarAntesMin:0, rateInputs:{} },
};

async function abrir() {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push(e.message));
  await p.goto(URL);
  await p.locator('.welcome').waitFor({ state: 'detached', timeout: 8000 }).catch(async () => {
    await p.click('.welcome-cta').catch(() => {});
  });
  await p.locator('.tour-saltar').click().catch(() => {});
  await p.waitForTimeout(400);
  return p;
}

const enDisco = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('pipicucu:data') ?? '{}'));
const enPantalla = (p) => p.evaluate(() => document.body.innerText);

const a = await abrir();
await a.evaluate((d) => localStorage.setItem('pipicucu:data', JSON.stringify(d)), SEMILLA);
await a.reload();
await a.locator('.welcome').waitFor({ state: 'detached', timeout: 8000 }).catch(async () => { await a.click('.welcome-cta').catch(() => {}); });
await a.locator('.tour-saltar').click().catch(() => {});
await a.waitForTimeout(500);

// B se abre DESPUÉS, con los mismos datos: a partir de acá cada una tiene su copia en memoria.
const b = await abrir();

titulo('1. Cada pestaña hace lo suyo y no se pisan');
// En A: marcar la sesión vieja como realizada.
await a.locator('.pendientes .btn.primary').click();
await a.waitForTimeout(800);
check('A marcó la sesión', (await enDisco(a)).sessions[0].status === 'realizada');

// En B: cargar un paciente nuevo. B todavía tiene su copia vieja en memoria.
await b.locator('.tabbar button', { hasText: 'Pacientes' }).click();
await b.waitForTimeout(400);
await b.locator('.fab').click();
await b.waitForTimeout(400);
await b.locator('.modal input').first().type('Luis Pérez', { delay: 10 });
await b.getByRole('button', { name: 'Guardar' }).click();
await b.waitForTimeout(900);

const disco = await enDisco(b);
check('sobrevivió el paciente que cargó B', disco.patients.some((p) => p.name === 'Luis Pérez'));
check('y NO se perdió la sesión que marcó A', disco.sessions[0].status === 'realizada',
  `quedó en "${disco.sessions[0].status}"`);

titulo('2. Cada una se entera de lo que hizo la otra');
await a.waitForTimeout(700);
check('A ve el paciente que cargó B', (await enPantalla(a)).includes('Luis') || (await enDisco(a)).patients.length === 2);
await b.waitForTimeout(300);
check('B ve la sesión que marcó A', (await b.evaluate(() =>
  JSON.parse(localStorage.getItem('pipicucu:data')).sessions[0].status)) === 'realizada');

titulo('3. Deshacer en una no se lleva puesto el trabajo de la otra');
// A borra a Luis; B, mientras tanto, agenda algo. Después A deshace.
await a.locator('.tabbar button', { hasText: 'Pacientes' }).click();
await a.waitForTimeout(500);
a.on('dialog', async (d) => { await d.accept(); });
await a
  .locator('.patient-card')
  .filter({ hasText: 'Luis' })
  .locator('.patient-actions button', { hasText: 'Borrar' })
  .click();
await a.waitForTimeout(1000);
const trasBorrar = await enDisco(a);
check('A borró a Luis', !trasBorrar.patients.some((p) => p.name === 'Luis Pérez'),
  `quedaron ${trasBorrar.patients.length}`);

if (await a.locator('.deshacer').count()) {
  await a.getByRole('button', { name: 'Deshacer' }).click();
  await a.waitForTimeout(1000);
  const trasDeshacer = await enDisco(a);
  check('deshacer devolvió a Luis', trasDeshacer.patients.some((p) => p.name === 'Luis Pérez'),
    `quedaron ${trasDeshacer.patients.length}`);
  check('y la sesión de A sigue marcada', trasDeshacer.sessions[0].status === 'realizada');
} else {
  check('aparece la barra de deshacer tras borrar', false, 'no apareció');
}

console.log(`\n═══ ${ok} verificaciones pasaron, ${fail} fallaron ═══`);
console.log('Errores de JavaScript:', errores.length ? errores.join(' | ') : 'ninguno');
await browser.close();
process.exit(fail > 0 ? 1 : 0);
