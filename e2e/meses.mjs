/**
 * Que cada mes muestre lo suyo.
 *
 * El caso que motivó esto: cobrar el mes vencido. Las sesiones de octubre se
 * cobran en noviembre, y la app restaba "facturado del mes menos cobrado del
 * mes". Esas dos cifras no se pueden restar —una cuenta sesiones del mes, la
 * otra plata que entró en el mes—, así que el pago de octubre le bajaba lo
 * pendiente a NOVIEMBRE y octubre quedaba impago para siempre.
 *
 * Lo que se prueba acá es que un pago cuenta en el mes de la sesión que salda,
 * no en el mes en que entró, en las dos pantallas donde se mira.
 *
 *   npx vite build && npx vite preview --port 4173 &
 *   node e2e/meses.mjs
 */
import { chromium } from 'playwright';

let ok = 0, fail = 0;
const check = (n, c, d = '') => {
  if (c) { ok++; console.log(`   ✓ ${n}${d ? ' — ' + d : ''}`); }
  else { fail++; console.log(`   ✗ FALLA: ${n}${d ? ' — ' + d : ''}`); }
};
const titulo = (t) => console.log(`\n── ${t} ──`);

const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 400, height: 1300 } });
const errores = [];
p.on('pageerror', (e) => errores.push(e.message));

const pasar = async () => {
  await p.locator('.welcome-cta').click({ timeout: 2500 }).catch(() => {});
  await p.locator('.welcome').waitFor({ state: 'detached', timeout: 2500 }).catch(() => {});
  await p.locator('.tour-saltar').click({ timeout: 2500 }).catch(() => {});
};

/*
 * Las fechas salen del reloj y no van escritas: una prueba con fechas fijas
 * empieza a mentir en cuanto pasa el tiempo. "Este mes" es el que la app abre
 * sola; el mes pasado es al que se llega con una flecha.
 */
const hoy = new Date();
const esteMes = new Date(hoy.getFullYear(), hoy.getMonth(), 7);
const mesPasado = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 7);
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

await p.goto(process.env.URL ?? 'http://localhost:4173/');
await pasar();
await p.evaluate(([delMesPasado, deEsteMes]) => {
  const sello = new Date().toISOString();
  const pac = (id, n, c) => ({ id, name: n, updatedAt: sello, defaultFee: 6000000, frequency: 'semanal',
    status: 'activo', colorIndex: c, email: '', phone: '', notes: '', kind: 'particular',
    createdAt: '2026-01-01', lastRaise: null, document: '', taxId: '', taxCondition: 'consumidor_final',
    legalName: '', memberNumber: '', insurer: '' });
  const ses = (id, pid, fecha, fee) => ({ id, patientId: pid, updatedAt: sello, date: fecha, time: '10:00',
    durationMin: 50, status: 'realizada', fee, chargeable: true, notes: '' });
  localStorage.setItem('pipicucu:data', JSON.stringify({
    version: 2,
    patients: [pac('p1', 'Tomas Wassermar', 0), pac('p2', 'Valentino', 2), pac('p3', 'Micaela', 4)],
    sessions: [
      ses('v1', 'p1', delMesPasado, 6000000),
      ses('v2', 'p2', delMesPasado, 5000000),
      ses('n1', 'p1', deEsteMes, 6000000),
      ses('n2', 'p2', deEsteMes, 5000000),
      // Micaela está al día y no tuvo sesiones este mes: existe para que el
      // filtro de "solo los que deben" tenga a quién dejar afuera. Sin alguien
      // así, esa prueba no podría fallar nunca.
      ses('v3', 'p3', delMesPasado, 4000000),
    ],
    payments: [
      // Entra ESTE mes y salda la sesión DEL MES PASADO de Tomas.
      { id: 'g1', patientId: 'p1', updatedAt: sello, date: deEsteMes, amount: 6000000,
        method: 'transferencia', notes: '' },
      { id: 'g2', patientId: 'p3', updatedAt: sello, date: delMesPasado, amount: 4000000,
        method: 'efectivo', notes: '' },
    ],
    deleted: { patients: [], sessions: [], payments: [] },
    settings: { profession: 'psicología', currency: '$', defaultDurationMin: 50,
      chargeNoShowByDefault: true, monthlyGoal: 0, reminderMinutes: 30, avisarAntesMin: 0,
      recordatorios: 'nula', rateInputs: {} },
  }));
}, [iso(mesPasado), iso(esteMes)]);
await p.goto(process.env.URL ?? 'http://localhost:4173/');
await pasar();
await p.locator('.tabbar button', { hasText: 'Finanzas' }).click();
await p.waitForTimeout(600);

titulo('1. El resumen del mes');
const stat = async (etiqueta) =>
  (await p.locator('.stat').filter({ hasText: etiqueta }).innerText()).replace(/\n/g, ' | ');

check('lo facturado cuenta las sesiones de este mes', (await stat('Facturado del mes')).includes('110.000'),
  await stat('Facturado del mes'));
// Esta es plata que entró en el mes, y por sí sola está bien: el pago entró
// ahora, aunque sea de una sesión vieja.
check('lo cobrado cuenta la plata que entró este mes', (await stat('Cobrado del mes')).includes('60.000'),
  await stat('Cobrado del mes'));
// El que estaba mal. Antes era 110.000 - 60.000 = 50.000, y decía que de este
// mes faltaba cobrar una sola sesión cuando faltan las dos.
const porCobrar = await stat('Por cobrar del mes');
check('lo que falta cobrar NO le resta el pago de una sesión vieja',
  porCobrar.includes('110.000'), porCobrar);
// El acumulado es otra pregunta y suma los dos meses: se facturaron 220.000
// entre los cuatro turnos y entraron 60.000.
check('y el acumulado suma los dos meses, que es otra pregunta',
  (await stat('Por cobrar en total')).includes('160.000'), await stat('Por cobrar en total'));

titulo('2. El monitoreo, mes por mes');
await p.locator('[role=tab]', { hasText: 'Monitoreo' }).click();
await p.waitForTimeout(700);
check('tiene su navegador de mes', (await p.locator('.mes-nav').count()) === 1);
const mesVisible = async () => p.locator('.mes-nav strong').innerText();
const filas = async () =>
  (await p.locator('.chart-row-btn').allInnerTexts()).map((t) => t.replace(/\n/g, ' '));

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const mesActualNombre = MESES[hoy.getMonth()].charAt(0).toUpperCase() + MESES[hoy.getMonth()].slice(1);
const esteMesNombre = await mesVisible();
const deEsteMes = await filas();
check('abre en el mes corriente', esteMesNombre.toLowerCase().includes(MESES[hoy.getMonth()]),
  esteMesNombre);
check('este mes los dos deben su sesión',
  deEsteMes.some((f) => f.includes('Tomas') && f.includes('60.000')) &&
  deEsteMes.some((f) => f.includes('Valentino') && f.includes('50.000')),
  deEsteMes.join(' / '));

await p.locator('.mes-nav button[aria-label="Mes anterior"]').click();
await p.waitForTimeout(600);
check('la flecha cambia de mes', (await mesVisible()) !== esteMesNombre, await mesVisible());
const delMesPasado = await filas();
// Acá está todo el asunto: el pago entró este mes y saldó la sesión del mes
// pasado, así que el mes pasado tiene que verse saldado.
check('el mes pasado, Tomas quedó al día gracias a ese pago',
  delMesPasado.some((f) => f.includes('Tomas') && f.includes('al día')), delMesPasado.join(' / '));
check('y Valentino sigue debiendo el mes pasado',
  delMesPasado.some((f) => f.includes('Valentino') && f.includes('50.000')), delMesPasado.join(' / '));

titulo('3. Lo que el mes no explica, se dice aparte');
check('la línea del mes dice lo facturado y lo cobrado de ESE mes',
  (await p.locator('.ref-note').first().innerText()).includes('la sesión que salda'));
const notas = await p.locator('.ref-note').allInnerTexts();
check('y el total acumulado se sigue viendo, para que una deuda vieja no se esconda',
  notas.some((t) => t.includes('todos los meses')), notas.join(' | ').slice(0, 120));

titulo('4. La asistencia también es del mes');
const asistencia = await p.locator('.chart-row:not(.chart-row-btn)').allInnerTexts();
check('se muestra la asistencia del mes elegido', asistencia.length > 0);
check('y lo dice, para que no se lea como de todo el historial',
  notas.some((t) => t.includes('El porcentaje cuenta solo sesiones')));
check('la comparación de honorarios avisa que NO es del mes',
  notas.some((t) => t.includes('honorario vigente')));

titulo('5. La cuenta de cada paciente');
// La pregunta que ninguna otra pantalla contestaba: entró un depósito, ¿de qué
// mes era? Acá se ve en fila, mes por mes, para una sola persona.
await p.locator('[role=tab]', { hasText: 'Cuentas' }).click();
await p.waitForTimeout(700);

const resumenes = await p.locator('.cuenta > summary').allInnerTexts();
check('cada paciente viene plegado, con su saldo a la vista',
  resumenes.length === 3 && resumenes.every((t) => /\$|al día/.test(t)),
  resumenes.map((t) => t.replace(/\n/g, ' ')).join(' / '));
check('primero el que más debe, porque es una lista para reclamar',
  (resumenes[0] ?? '').includes('Tomas') || (resumenes[0] ?? '').includes('Valentino'),
  (resumenes[0] ?? '').replace(/\n/g, ' '));

const tomas = p.locator('.cuenta').filter({ hasText: 'Tomas' });
await tomas.locator('summary').click();
await p.waitForTimeout(400);
const filasTomas = await tomas.locator('tbody tr').allInnerTexts();
check('abre una fila por mes con sesiones', filasTomas.length === 2, String(filasTomas.length));
// El depósito entró este mes y pagó la sesión del mes pasado: la fila del mes
// pasado tiene que mostrarlo cobrado, y la de este mes debiendo.
const textoViejo = (filasTomas.find((f) => !f.includes(mesActualNombre)) ?? '').replace(/\s+/g, ' ');
const textoNuevo = (filasTomas.find((f) => f.includes(mesActualNombre)) ?? '').replace(/\s+/g, ' ');
// Facturó 60.000, pagó 60.000 y no debe nada: la raya es la columna "Debe".
check('el mes viejo se ve saldado por el depósito de este mes',
  textoViejo.includes('$ 60.000 $ 60.000 —'), textoViejo);
// Facturó 60.000, pagó 0 y debe 60.000.
check('y el mes corriente se ve debiendo',
  textoNuevo.includes('$ 60.000 $ 0 $ 60.000'), textoNuevo);

const total = await tomas.locator('tfoot tr').innerText();
check('el total suma los meses', total.includes('120.000') && total.includes('60.000'),
  total.replace(/\n/g, ' '));
check('y desde acá también se puede cobrar',
  (await tomas.locator('.btn', { hasText: 'Registrar un cobro' }).count()) === 1);

// Nada se puede ir del borde: la columna de lo que debe es la que se vino a
// mirar, y una tabla que se arrastra de costado la esconde justo a ella.
const desborde = await p.evaluate(() => {
  const caja = document.querySelector('.cuenta[open] .table-wrap');
  return {
    tabla: caja ? caja.scrollWidth - caja.clientWidth : -1,
    pagina: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    pestanas: (() => { const t = document.querySelector('.tabs'); return t ? t.scrollWidth - t.clientWidth : -1; })(),
  };
});
check('la tabla entra sin arrastrarse de costado', desborde.tabla <= 0, JSON.stringify(desborde));
check('y las cuatro pestañas entran en la pantalla',
  desborde.pestanas <= 0 && desborde.pagina <= 0, JSON.stringify(desborde));

const antesDelFiltro = await p.locator('.cuenta').count();
check('están los tres, incluida la que está al día', antesDelFiltro === 3, String(antesDelFiltro));
await p.locator('.btn', { hasText: 'Solo los que deben' }).click();
await p.waitForTimeout(400);
const conFiltro = await p.locator('.cuenta').allInnerTexts();
check('el filtro deja afuera a la que está al día',
  conFiltro.length === 2 && !conFiltro.some((t) => t.includes('Micaela')),
  conFiltro.map((t) => t.split('\n')[0]).join(' / '));

console.log(`\n═══ ${ok} verificaciones pasaron, ${fail} fallaron ═══`);
console.log('Errores de JavaScript:', errores.length ? errores.join(' | ') : 'ninguno');
await browser.close();
process.exit(fail > 0 ? 1 : 0);
