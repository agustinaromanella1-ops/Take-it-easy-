/**
 * Los borradores de los tres formularios largos.
 *
 * Lo que se escribe no se pierde por cerrar una pantalla. Es la clase de cosa
 * que solo se ve interrumpiendo de verdad: escribir, cerrar sin guardar,
 * volver a abrir. Las pruebas unitarias cubren el módulo; esto cubre que los
 * tres formularios lo usen bien.
 *
 *   npx vite build && npx vite preview --port 4173 &
 *   node e2e/borradores.mjs
 */
import { chromium } from 'playwright';

let ok = 0, fail = 0;
const check = (n, c, d = '') => {
  if (c) { ok++; console.log(`   ✓ ${n}${d ? ' — ' + d : ''}`); }
  else { fail++; console.log(`   ✗ FALLA: ${n}${d ? ' — ' + d : ''}`); }
};
const titulo = (t) => console.log(`\n── ${t} ──`);

const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 420, height: 950 } });
const errores = [];
p.on('pageerror', (e) => errores.push(e.message));

const pasar = async () => {
  await p.locator('.welcome').waitFor({ state: 'detached', timeout: 8000 }).catch(async () => {
    await p.click('.welcome-cta').catch(() => {});
  });
  await p.locator('.tour-saltar').click().catch(() => {});
};

await p.goto(process.env.URL ?? 'http://localhost:4173/');
await pasar();
await p.evaluate(() => {
  const sello = new Date().toISOString();
  localStorage.setItem('pipicucu:data', JSON.stringify({
    version: 2,
    patients: [{ id:'p1', name:'Ana Gómez', updatedAt:sello, defaultFee:3500000, frequency:'semanal',
      status:'activo', colorIndex:0, email:'', phone:'', notes:'', kind:'particular', createdAt:'2026-01-01',
      lastRaise:null, document:'', taxId:'', taxCondition:'consumidor_final', legalName:'', memberNumber:'', insurer:'' }],
    sessions: [], payments: [], deleted: { patients: [], sessions: [], payments: [] },
    settings: { profession:'psicología', currency:'$', defaultDurationMin:50, chargeNoShowByDefault:true,
      monthlyGoal:0, reminderMinutes:30, avisarAntesMin:0, rateInputs:{} },
  }));
});
await p.reload();
await pasar();
await p.waitForTimeout(700);

/** Escribe, cierra sin guardar, reabre y comprueba que se ofrezca retomar. */
async function recorrido(nombre, abrir, escribir, leer) {
  titulo(nombre);
  await abrir();
  await escribir();
  const escrito = await leer();
  check('se escribió algo', escrito !== '', JSON.stringify(escrito));

  // Se cierra sin guardar, como si sonara el timbre.
  await p.locator('.modal-close').click();
  await p.waitForTimeout(500);

  await abrir();
  const aviso = p.locator('.borrador-aviso');
  check('al volver, ofrece retomarlo', (await aviso.count()) === 1);
  check('y no lo aplica solo', (await leer()) !== escrito, 'el formulario arranca limpio');

  // Escribir antes de decidir no puede pisar lo que el cartel promete.
  await escribir();
  await p.getByRole('button', { name: 'Retomarlo' }).click();
  await p.waitForTimeout(300);
  check('"Retomarlo" devuelve lo de la vez pasada', (await leer()) === escrito, JSON.stringify(await leer()));

  await p.getByRole('button', { name: 'Empezar de cero' }).click();
  await p.waitForTimeout(300);
  check('"Empezar de cero" lo tira', (await leer()) !== escrito);
  check('y el cartel se va', (await aviso.count()) === 0);

  await p.locator('.modal-close').click();
  await p.waitForTimeout(400);
  await abrir();
  check('descartado, ya no se ofrece', (await p.locator('.borrador-aviso').count()) === 0);
  await p.locator('.modal-close').click();
  await p.waitForTimeout(400);
}

const irA = async (seccion) => {
  await p.locator('.tabbar button', { hasText: seccion }).click();
  await p.waitForTimeout(500);
};

await recorrido(
  '1. Alta de paciente',
  async () => { await irA('Pacientes'); await p.locator('.fab').click(); await p.waitForTimeout(400); },
  async () => { await p.locator('.modal input').first().fill(''); await p.locator('.modal input').first().type('Mariana Prueba', { delay: 10 }); },
  async () => p.locator('.modal input').first().inputValue(),
);

await recorrido(
  '2. Turno nuevo',
  async () => { await irA('Agenda'); await p.locator('.fab').click(); await p.waitForTimeout(400); },
  async () => { const t = p.locator('.modal textarea').first(); await t.fill(''); await t.type('Trae los estudios', { delay: 10 }); },
  async () => p.locator('.modal textarea').first().inputValue(),
);

await recorrido(
  '3. Cobro',
  async () => { await irA('Finanzas'); await p.locator('.fab').click(); await p.waitForTimeout(400); },
  // En el cobro la nota es un input, no un textarea: es el último campo.
  async () => { const t = p.locator('.modal .field').last().locator('input'); await t.fill(''); await t.type('Transferencia de marzo', { delay: 10 }); },
  async () => p.locator('.modal .field').last().locator('input').inputValue(),
);

titulo('4. Guardar de verdad borra el borrador');
await irA('Pacientes');
await p.locator('.fab').click();
await p.waitForTimeout(400);
await p.locator('.modal input').first().type('Guardado Real', { delay: 10 });
await p.getByRole('button', { name: 'Guardar' }).click();
await p.waitForTimeout(600);
await p.locator('.fab').click();
await p.waitForTimeout(400);
check('tras guardar, no queda borrador', (await p.locator('.borrador-aviso').count()) === 0);
await p.locator('.modal-close').click();

console.log(`\n═══ ${ok} verificaciones pasaron, ${fail} fallaron ═══`);
console.log('Errores de JavaScript:', errores.length ? errores.join(' | ') : 'ninguno');
await browser.close();
process.exit(fail > 0 ? 1 : 0);
