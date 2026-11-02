/**
 * El regulador de recordatorios, de punta a punta.
 *
 * Lo que importa probar acá es lo que no se ve leyendo el código:
 *
 * 1. Que el aviso salga por `ServiceWorkerRegistration.showNotification()` y
 *    no por `new Notification()`. Ese constructor tira una excepción en Chrome
 *    de Android, que es donde se usa la app: el camino viejo no funcionaba en
 *    el celular y no había forma de enterarse, porque fallaba adentro de un
 *    `catch` vacío.
 * 2. Que cada nivel mande lo que dice Ajustes, y que la "nula" no mande nada.
 * 3. Que no se avise de nada: con el día ya marcado y cobrado, silencio.
 * 4. Que abrir la app a la noche después de un día entero cerrada no largue la
 *    pila de avisos del día.
 * 5. Que contestar desde la notificación —por la dirección con la que se abre
 *    la ventana— marque la sesión de verdad.
 *
 * El reloj se fija con `page.clock` porque los recordatorios son a hora fija:
 * sin eso la prueba pasaría o fallaría según la hora a la que se corra.
 *
 *   npx vite build && npx vite preview --port 4173 &
 *   node e2e/recordatorios.mjs
 */
import { chromium } from 'playwright';

let ok = 0, fail = 0;
const check = (n, c, d = '') => {
  if (c) { ok++; console.log(`   ✓ ${n}${d ? ' — ' + d : ''}`); }
  else { fail++; console.log(`   ✗ FALLA: ${n}${d ? ' — ' + d : ''}`); }
};
const titulo = (t) => console.log(`\n── ${t} ──`);

const BASE = process.env.URL ?? 'http://localhost:4173/';
const HOY = '2026-09-21';

/*
 * El headless nuevo de Chrome deniega los avisos pase lo que pase: con el
 * permiso concedido por CDP, `Notification.requestPermission()` contesta
 * "granted" pero `Notification.permission` sigue leyendo "denied", y la app
 * mira esa propiedad. El headless viejo lo informa como un navegador de
 * verdad, que es lo que hace falta para probar esto.
 */
const browser = await chromium.launch({ headless: false, args: ['--headless=old', '--no-sandbox'] });
const errores = [];

/**
 * Una página con el reloj fijo, permiso de avisos y los avisos espiados.
 *
 * El espía reemplaza `showNotification` en el prototipo del registro, que es
 * por donde pasan todos los avisos de la app. Si alguien volviera a usar
 * `new Notification()`, acá no se vería nada: ese es justamente el punto.
 */
/**
 * Pasa la portada y los carteles del tour.
 *
 * Con plazos cortos y a propósito: un `click()` sin `timeout` sobre algo que
 * no está espera los 30 segundos de fábrica, y esta prueba abre trece
 * ventanas. Lo que acá hay que esperar aparece en menos de dos segundos o no
 * va a aparecer nunca.
 */
async function pasar(p) {
  await p.locator('.welcome-cta').click({ timeout: 2500 }).catch(() => {});
  await p.locator('.welcome').waitFor({ state: 'detached', timeout: 2500 }).catch(() => {});
  await p.locator('.tour-saltar').click({ timeout: 2500 }).catch(() => {});
}

async function abrir({ hora, nivel, sesiones, pagos = [], url = BASE }) {
  const ctx = await browser.newContext({
    viewport: { width: 420, height: 950 },
    permissions: ['notifications'],
  });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push(e.message));

  // `setFixedTime` y no `install`: `install` también congela `setTimeout` y
  // `setInterval`, y con eso React nunca llega a dibujar nada. Acá lo único
  // que hace falta mentir es la hora.
  await p.clock.setFixedTime(new Date(`${HOY}T${hora}:00`));

  // El espía se pone sobre el prototipo y de entrada, sin esperar a que el
  // service worker esté listo: si esperara, la app podría mandar su aviso
  // primero y la prueba no vería nada.
  await p.addInitScript(() => {
    window.__avisos = [];
    const proto = window.ServiceWorkerRegistration?.prototype;
    if (!proto) return;
    const original = proto.showNotification;
    proto.showNotification = function (titulo, opciones) {
      window.__avisos.push({ titulo, ...opciones });
      return original.call(this, titulo, opciones);
    };
  });

  await p.goto(url);
  await pasar(p);

  await p.evaluate(([nivel, sesiones, pagos, hoy]) => {
    const sello = new Date().toISOString();
    const pac = { id: 'p1', name: 'Ana Gómez', updatedAt: sello, defaultFee: 3500000, frequency: 'semanal',
      status: 'activo', colorIndex: 0, email: '', phone: '', notes: '', kind: 'particular',
      createdAt: '2026-01-01', lastRaise: null, document: '', taxId: '', taxCondition: 'consumidor_final',
      legalName: '', memberNumber: '', insurer: '' };
    localStorage.setItem('pipicucu:data', JSON.stringify({
      version: 2,
      patients: [pac],
      sessions: sesiones.map((s) => ({ patientId: 'p1', updatedAt: sello, date: hoy, durationMin: 50,
        status: 'programada', fee: 3500000, chargeable: true, notes: '', ...s })),
      payments: pagos.map((g) => ({ patientId: 'p1', updatedAt: sello, date: hoy, amount: 3500000,
        method: 'efectivo', notes: '', ...g })),
      deleted: { patients: [], sessions: [], payments: [] },
      settings: { profession: 'psicología', currency: '$', defaultDurationMin: 50,
        chargeNoShowByDefault: true, monthlyGoal: 0, reminderMinutes: 30, avisarAntesMin: 0,
        recordatorios: nivel, rateInputs: {} },
    }));
    // De un día anterior: si quedara, el recordatorio se daría por hecho.
    localStorage.removeItem('pipicucu:recordatorios');
  }, [nivel, sesiones, pagos, HOY]);

  await p.goto(url);
  await pasar(p);
  await p.waitForTimeout(1200);
  return { p, ctx, avisos: () => p.evaluate(() => window.__avisos ?? []) };
}

const SIN_MARCAR = [{ id: 's1', time: '09:00' }, { id: 's2', time: '10:00' }];
const UNA_SIN_MARCAR = [{ id: 's1', time: '09:00' }];
const TODO_HECHO = [{ id: 's1', time: '09:00', status: 'realizada' }];

titulo('1. El aviso sale por el service worker');
{
  const { p, ctx, avisos } = await abrir({ hora: '18:05', nivel: 'alta', sesiones: SIN_MARCAR });
  const a = await avisos();
  check('a las 18:05 salió el recordatorio de marcar', a.length === 1, `${a.length} avisos`);
  check('con ícono de la app, no de "una página web"', a[0]?.icon === '/icon-192.png');
  check('y con tag propio, para que no se apile con el de cobros', a[0]?.tag === 'pipicucu:marcar');
  check('no nombra al paciente', !`${a[0]?.titulo} ${a[0]?.body}`.includes('Ana'));
  check('con dos sin marcar no trae botones, porque no se sabría de quién',
    a[0]?.actions === undefined, JSON.stringify(a[0]?.actions));
  await ctx.close();
}

titulo('2. Con una sola sin marcar, el aviso pregunta por ella y trae botones');
{
  const { ctx, avisos } = await abrir({ hora: '18:05', nivel: 'alta', sesiones: UNA_SIN_MARCAR });
  const a = (await avisos())[0];
  check('el título dice la hora, que es lo único que la identifica sin nombrarla',
    a?.titulo?.includes('09:00'), a?.titulo);
  check('trae botones para contestar sin abrir nada', (a?.actions ?? []).length > 0,
    JSON.stringify(a?.actions));
  check('el primero es "Vino"', a?.actions?.[0]?.action === 'vino');
  check('y guarda de qué sesión habla', a?.data?.sesion === 's1');
  await ctx.close();
}

titulo('3. Cada nivel manda lo suyo');
{
  const { ctx, avisos } = await abrir({ hora: '18:05', nivel: 'nula', sesiones: SIN_MARCAR });
  check('la nula no manda nada', (await avisos()).length === 0);
  await ctx.close();
}
{
  // A las 18:05 la baja todavía no dijo nada: su único momento es el cierre.
  const { ctx, avisos } = await abrir({ hora: '18:05', nivel: 'baja', sesiones: SIN_MARCAR });
  check('la baja no habla durante el día', (await avisos()).length === 0);
  await ctx.close();
}
{
  // Última sesión 10:00 + 50 -> el cierre cae al piso de las 18:30.
  const { ctx, avisos } = await abrir({ hora: '18:35', nivel: 'baja', sesiones: SIN_MARCAR });
  const a = (await avisos())[0];
  check('pero sí al cerrar el día', a?.titulo === 'Cerrá el día', a?.titulo);
  check('y dice cuánto quedó abierto', a?.body?.includes('2 sin marcar'), a?.body);
  await ctx.close();
}
{
  const { ctx, avisos } = await abrir({ hora: '16:10', nivel: 'media',
    sesiones: [{ id: 's1', time: '09:00', status: 'realizada' }] });
  const a = (await avisos())[0];
  check('la media avisa a las 16 por lo que falta cobrar',
    a?.titulo?.includes('sin cobrar'), a?.titulo);
  check('ese aviso no trae botones de asistencia', a?.actions === undefined);
  await ctx.close();
}

titulo('4. No se avisa de nada');
{
  const { ctx, avisos } = await abrir({ hora: '18:35', nivel: 'alta', sesiones: TODO_HECHO,
    pagos: [{ id: 'g1', sessionId: 's1' }] });
  check('con el día marcado y cobrado, silencio', (await avisos()).length === 0);
  await ctx.close();
}
{
  // La sesión todavía está pasando: preguntar por ella es peor que callarse.
  const { ctx, avisos } = await abrir({ hora: '18:05', nivel: 'alta',
    sesiones: [{ id: 's1', time: '17:40' }] });
  check('no pregunta por una sesión que está pasando', (await avisos()).length === 0);
  await ctx.close();
}

titulo('5. Abrir a la noche no larga la pila del día');
{
  const { ctx, avisos } = await abrir({ hora: '23:30', nivel: 'alta', sesiones: SIN_MARCAR });
  check('después de la ventana no sale ninguno', (await avisos()).length === 0);
  await ctx.close();
}
{
  const { p, ctx, avisos } = await abrir({ hora: '18:35', nivel: 'alta', sesiones: SIN_MARCAR });
  check('sale uno solo y no los cuatro del día', (await avisos()).length === 1,
    `${(await avisos()).length} avisos`);
  const hechos = await p.evaluate(() =>
    JSON.parse(localStorage.getItem('pipicucu:recordatorios') ?? '{"ids":[]}').ids);
  check('y los anteriores quedan dados por vencidos', hechos.length > 1, hechos.join(', '));
  await ctx.close();
}

titulo('6. Contestar desde la notificación');
{
  const { p, ctx } = await abrir({ hora: '18:35', nivel: 'alta', sesiones: UNA_SIN_MARCAR,
    url: `${BASE}?hacer=vino&sesion=s1` });
  const estado = await p.evaluate(() =>
    JSON.parse(localStorage.getItem('pipicucu:data')).sessions.find((s) => s.id === 's1').status);
  check('tocar "Vino" en el aviso deja la sesión realizada', estado === 'realizada', estado);
  check('y la dirección queda limpia, para que recargar no la desmarque',
    !p.url().includes('hacer='), p.url());
  check('la app queda en el inicio, con la fila a la vista',
    (await p.locator('.hoy-fila').count()) > 0);
  check('y ofrece deshacer, como cualquier otro cambio',
    (await p.locator('.deshacer').count()) === 1);
  await ctx.close();
}
{
  const { p, ctx } = await abrir({ hora: '18:35', nivel: 'alta', sesiones: UNA_SIN_MARCAR,
    url: `${BASE}?hacer=reagendo&sesion=s1` });
  check('"Reagendó" abre el cuadro de mover el turno, porque necesita una fecha',
    (await p.locator('.modal input[type=date]').count()) === 1);
  const estado = await p.evaluate(() =>
    JSON.parse(localStorage.getItem('pipicucu:data')).sessions.find((s) => s.id === 's1').status);
  check('y no toca nada hasta que se elija', estado === 'programada', estado);
  await ctx.close();
}
{
  const { p, ctx } = await abrir({ hora: '18:35', nivel: 'alta', sesiones: TODO_HECHO,
    url: `${BASE}?hacer=vino&sesion=s1` });
  const estado = await p.evaluate(() =>
    JSON.parse(localStorage.getItem('pipicucu:data')).sessions.find((s) => s.id === 's1').status);
  check('un aviso viejo no pisa lo que ya se decidió en la app', estado === 'realizada', estado);
  await ctx.close();
}
{
  const { p, ctx } = await abrir({ hora: '18:35', nivel: 'alta', sesiones: UNA_SIN_MARCAR,
    url: `${BASE}?hacer=session%2Fremove&sesion=s1` });
  const d = await p.evaluate(() => JSON.parse(localStorage.getItem('pipicucu:data')));
  check('una dirección con cualquier otra cosa no hace nada',
    d.sessions.length === 1 && d.sessions[0].status === 'programada');
  await ctx.close();
}

console.log(`\n═══ ${ok} verificaciones pasaron, ${fail} fallaron ═══`);
console.log(`Errores de JavaScript: ${errores.length ? errores.join(' | ') : 'ninguno'}`);
await browser.close();
process.exit(fail ? 1 : 0);
