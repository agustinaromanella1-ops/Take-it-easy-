/**
 * Las sesiones de hoy en el inicio, con sus dos preguntas.
 *
 * "¿Vino?" y "¿Pagó?" se contestaban entrando al día en la Agenda o abriendo
 * el cierre del día. Esto las pone en la pantalla que se abre sin pensar.
 *
 * Lo que más importa probar es el cobro: un cobro no era un dato de la sesión
 * —son registros sueltos por paciente— así que marcar y desmarcar tiene que
 * crear y sacar EXACTAMENTE ese cobro y no otro del mismo día.
 *
 *   npx vite build && npx vite preview --port 4173 &
 *   node e2e/hoy.mjs
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

const disco = () => p.evaluate(() => JSON.parse(localStorage.getItem('pipicucu:data') ?? '{}'));
const fila = (i) => p.locator('.hoy-fila').nth(i);

await p.goto(process.env.URL ?? 'http://localhost:4173/');
await pasar();
await p.evaluate(() => {
  const sello = new Date().toISOString();
  const hoy = new Date().toISOString().slice(0, 10);
  const ayer = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const pac = (id, n, c) => ({ id, name:n, updatedAt:sello, defaultFee:3500000, frequency:'semanal',
    status:'activo', colorIndex:c, email:'', phone:'', notes:'', kind:'particular', createdAt:'2026-01-01',
    lastRaise:null, document:'', taxId:'', taxCondition:'consumidor_final', legalName:'', memberNumber:'', insurer:'' });
  const ses = (id, pid, fecha, hora) => ({ id, patientId:pid, updatedAt:sello, date:fecha, time:hora,
    durationMin:50, status:'programada', fee:3500000, chargeable:true, notes:'' });
  localStorage.setItem('pipicucu:data', JSON.stringify({
    version: 2,
    patients: [pac('p1','Ana Gómez',0), pac('p2','Luis Pérez',2)],
    // Dos de hoy, en desorden a propósito, y una de ayer que NO tiene que salir.
    sessions: [ses('s2','p2',hoy,'11:00'), ses('s1','p1',hoy,'09:00'), ses('viejo','p1',ayer,'10:00')],
    payments: [], deleted: { patients: [], sessions: [], payments: [] },
    settings: { profession:'psicología', currency:'$', defaultDurationMin:50, chargeNoShowByDefault:true,
      monthlyGoal:0, reminderMinutes:30, avisarAntesMin:0, rateInputs:{} },
  }));
});
await p.reload();
await pasar();
await p.waitForTimeout(700);

titulo('1. Lo que muestra');
check('están las dos sesiones de hoy, y solo esas', (await p.locator('.hoy-fila').count()) === 2);
check('ordenadas por hora y no por cómo se cargaron',
  (await fila(0).innerText()).includes('09:00'), (await fila(0).innerText()).split('\n')[0]);

titulo('2. ¿Vino?');
await fila(0).getByRole('button', { name: 'Vino' }).click();
await p.waitForTimeout(600);
check('marcar "Vino" deja la sesión como realizada',
  (await disco()).sessions.find((s) => s.id === 's1')?.status === 'realizada');
await fila(0).getByRole('button', { name: 'Vino' }).click();
await p.waitForTimeout(600);
check('volver a tocarlo la devuelve a programada, que es cómo se corrige',
  (await disco()).sessions.find((s) => s.id === 's1')?.status === 'programada');
await fila(1).getByRole('button', { name: 'Faltó' }).click();
await p.waitForTimeout(600);
check('"Faltó" la deja como ausente',
  (await disco()).sessions.find((s) => s.id === 's2')?.status === 'ausente');

titulo('3. ¿Pagó?');
await fila(0).locator('.hoy-cobro').click();
await p.waitForTimeout(600);
let pagos = (await disco()).payments;
check('registra un cobro', pagos.length === 1);
check('por el honorario de la sesión', pagos[0]?.amount === 3500000);
check('atado a esa sesión, no suelto', pagos[0]?.sessionId === 's1');
check('y el botón lo muestra', (await fila(0).locator('.hoy-cobro').innerText()).includes('✓'));

// El cobro de la otra sesión es del mismo día y el mismo importe: desmarcar
// una no puede llevarse el de la otra.
await fila(1).locator('.hoy-cobro').click();
await p.waitForTimeout(600);
check('la segunda sesión registra el suyo', (await disco()).payments.length === 2);
await fila(0).locator('.hoy-cobro').click();
await p.waitForTimeout(600);
pagos = (await disco()).payments;
check('desmarcar una saca SOLO su cobro', pagos.length === 1, `quedó ${pagos.length}`);
check('y el que queda es el de la otra', pagos[0]?.sessionId === 's2');
check('el botón de la primera volvió a quedar apagado',
  !(await fila(0).locator('.hoy-cobro').innerText()).includes('✓'));

titulo('4. Las dos preguntas son independientes');
// Cobrar por adelantado, o cobrarle a quien faltó, son casos normales.
check('la segunda está marcada como ausente y cobrada',
  (await disco()).sessions.find((s) => s.id === 's2')?.status === 'ausente' &&
    (await disco()).payments.some((g) => g.sessionId === 's2'));

titulo('5. Se puede deshacer');
// Sin espera larga en el medio: la barra se va sola a los diez segundos.
await fila(0).locator('.hoy-cobro').click();
check('marcar un cobro ofrece deshacerlo', (await p.locator('.deshacer').count()) === 1);
await p.getByRole('button', { name: 'Deshacer' }).click();
await p.waitForTimeout(700);
check('y deshacerlo saca el cobro',
  !(await disco()).payments.some((g) => g.sessionId === 's1'),
  `quedaron ${(await disco()).payments.length} cobros`);

console.log(`\n═══ ${ok} verificaciones pasaron, ${fail} fallaron ═══`);
console.log('Errores de JavaScript:', errores.length ? errores.join(' | ') : 'ninguno');
await browser.close();
process.exit(fail > 0 ? 1 : 0);
