/**
 * Prueba de aceptación de punta a punta.
 *
 * Carga los datos por la interfaz real —no inyectándolos en localStorage— y
 * después comprueba que sobrevivan a una recarga, a un ciclo de exportar,
 * borrar todo e importar, y a quedarse sin conexión. Es la prueba que responde
 * "¿se guarda todo y se recupera?".
 *
 *   npx vite build && npx vite preview --port 4173 &
 *   node e2e/aceptacion.mjs
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const SC = process.env.SC ?? '/tmp';
const errs = [];
let ok = 0, fail = 0;

function check(nombre, condicion, detalle = '') {
  if (condicion) { ok++; console.log(`   ✓ ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { fail++; console.log(`   ✗ FALLA: ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
const titulo = (t) => console.log(`\n── ${t} ──`);

/** Comparación por valor, insensible al orden de las claves: al importar, la
 *  app reconstruye cada objeto con su propio orden de campos. */
function mismosDatos(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((v, i) => mismosDatos(v, b[i]));
  if (typeof a === 'object') {
    const claves = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...claves].every((k) => mismosDatos(a[k], b[k]));
  }
  return false;
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('favicon')) errs.push(m.text()); });

/** La bienvenida tapa la pantalla al abrir: hay que sacarla antes de tocar nada. */
async function saltarBienvenida() {
  // La bienvenida aparece solo la primera vez y se pasa con Empezar. Si ya se
  // vio, no está y esto no hace nada.
  const cta = page.locator('.welcome-cta');
  if (await cta.count()) {
    await cta.click({ timeout: 3000 }).catch(() => {});
    await page.locator('.welcome').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
  }
  // Y los carteles que salen enseguida: tapan toda la pantalla hasta que se
  // los saltea.
  const saltar = page.locator('.tour-saltar');
  if (await saltar.count()) {
    await saltar.click({ timeout: 3000 }).catch(() => {});
    await page.locator('.tour').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
  }
}

const campo = (etiqueta) => page.locator('.modal .field').filter({ hasText: etiqueta }).locator('input, select, textarea').first();

/** Abre los bloques plegados del formulario. El alta arranca corta a propósito:
 *  lo que no hace falta para empezar está adentro de un <details> cerrado. */
async function abrirPlegables() {
  await page.locator('.modal details.plegable:not([open]) > summary').evaluateAll((s) => s.forEach((e) => e.click()));
  await page.waitForTimeout(150);
}

await page.goto(process.env.URL ?? 'http://localhost:4173/', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await saltarBienvenida();

titulo('1. Arranque limpio');
check('la app abre vacía', await page.locator('.empty strong', { hasText: 'Tu agenda, pipí cucú.' }).isVisible());

titulo('2. Sin pacientes, los botones explican en vez de no hacer nada');
await page.locator('.tabbar button', { hasText: 'Agenda' }).click();
await page.waitForTimeout(400);
check('el + de la agenda no está muerto', !(await page.locator('.fab').isDisabled()));
await page.locator('.fab').click();
await page.waitForTimeout(400);
check('explica qué falta', (await page.locator('.modal-head h2').innerText()) === 'Primero cargá un paciente');
await page.locator('.modal').getByRole('button', { name: 'Ir a Pacientes' }).click();
await page.waitForTimeout(500);
check('y lleva a Pacientes', (await page.locator('h1').first().innerText()) === 'Pacientes');

await page.locator('.tabbar button', { hasText: 'Finanzas' }).click();
await page.waitForTimeout(400);
await page.locator('.fab').click();
await page.waitForTimeout(400);
check('lo mismo al registrar un pago', (await page.locator('.modal-head h2').innerText()) === 'Primero cargá un paciente');
await page.locator('.modal').getByRole('button', { name: 'Ahora no' }).click();
await page.waitForTimeout(300);

await page.locator('.tabbar button', { hasText: 'Agenda' }).click();
await page.waitForTimeout(300);
await page.locator('.tabs button', { hasText: 'Mes' }).click();
await page.waitForTimeout(400);
const pista = await page.locator('.pista').innerText();
check('el calendario avisa que sirve para días pasados', pista.includes('ya pasó'), pista.slice(0, 44) + '…');

// Se vuelve al inicio, que es donde arranca el recorrido de más abajo.
await page.locator('.tabbar button', { hasText: 'Inicio' }).click();
await page.waitForTimeout(400);

titulo('3. Se puede escribir sin que salte el foco');
// El modal devolvía el foco al primer campo en cada render, y el padre
// re-renderiza en cada tecla: escribir un honorario de cinco cifras era
// imposible, al segundo dígito el cursor saltaba al nombre.
await page.locator('.tabbar button', { hasText: 'Pacientes' }).click();
await page.waitForTimeout(400);
await page.locator('.fab').click();
await page.waitForTimeout(400);
const campoHonorario = page.locator('.modal .field').filter({ hasText: 'Honorario' }).locator('input').first();
await campoHonorario.click();
for (const d of '35000') await page.keyboard.type(d, { delay: 25 });
check('se escribe el número entero, no solo el primer dígito', (await campoHonorario.inputValue()) === '35000', await campoHonorario.inputValue());
check('el foco no se va a otro campo', await campoHonorario.evaluate((el) => el === document.activeElement));
await page.keyboard.press('Backspace');
check('borrar tampoco lo mueve', await campoHonorario.evaluate((el) => el === document.activeElement));
await page.locator('.modal-close').click();
await page.waitForTimeout(300);
await page.locator('.tabbar button', { hasText: 'Inicio' }).click();
await page.waitForTimeout(400);

titulo('4. Alta de paciente con TODOS los campos');
await page.getByRole('button', { name: 'Cargar primer paciente' }).click();
await page.waitForTimeout(400);
await page.locator('.fab').click();
await page.waitForTimeout(300);

const P1 = {
  nombre: 'Ana Gómez', email: 'ana@ejemplo.com', tel: '011 15 4444-5555', honorario: '42500.50',
  tipo: 'institucion', frecuencia: 'quincenal', estado: 'activo',
  completo: 'Ana Laura Gómez Sosa', dni: '30111222', cuit: '27301112223',
  iva: 'monotributo', os: 'Swiss Medical', afiliado: 'SM-99/04', notas: 'Prefiere los martes.',
};
// El alta arranca con lo mínimo: cargar a alguien no puede ser un trámite de
// quince campos. Lo demás está plegado y no es obligatorio.
const camposALaVista = await page.locator('.modal > .field, .modal > .field-row > .field').count();
check('el alta arranca corta', camposALaVista <= 4, `${camposALaVista} campos a la vista`);
check('y el resto está plegado', (await page.locator('.modal details.plegable').count()) === 2);
check('los plegables arrancan cerrados en un alta', (await page.locator('.modal details.plegable[open]').count()) === 0);

await abrirPlegables();
await campo('Nombre y apellido').fill(P1.nombre);
await campo('Email').fill(P1.email);
await campo('Teléfono').fill(P1.tel);
await campo('Honorario por sesión').fill(P1.honorario);
await campo('Tipo').selectOption(P1.tipo);
await campo('Frecuencia').selectOption(P1.frecuencia);
await page.locator('.modal .swatch').nth(4).click();
await campo('Nombre completo').fill(P1.completo);
await campo('DNI').fill(P1.dni);
await campo('CUIT / CUIL').fill(P1.cuit);
await campo('Condición frente al IVA').selectOption(P1.iva);
await campo('Obra social / prepaga').fill(P1.os);
await campo('N.º de afiliado').fill(P1.afiliado);
await campo('Notas').fill(P1.notas);
await page.getByRole('button', { name: 'Guardar' }).click();
await page.waitForTimeout(500);
check('el paciente aparece en la lista', (await page.locator('.patient-card').count()) === 1);
check('muestra tipo y frecuencia', (await page.locator('.patient-sub').first().textContent())?.includes('Institución'));

// Segundo paciente, más simple.
await page.locator('.fab').click();
await page.waitForTimeout(300);
await campo('Nombre y apellido').fill('Bruno Díaz');
await campo('Honorario por sesión').fill('30000');
await page.getByRole('button', { name: 'Guardar' }).click();
await page.waitForTimeout(500);
check('se cargan dos pacientes', (await page.locator('.patient-card').count()) === 2);

titulo('5. Agenda: sesión suelta y serie recurrente');
await page.locator('.tabbar button', { hasText: 'Agenda' }).click();
await page.waitForTimeout(400);
await page.locator('.fab').click();
await page.waitForTimeout(400);
await campo('Paciente').selectOption({ index: 1 });
await campo('Hora').fill('09:00');
await page.getByRole('button', { name: 'Guardar' }).click();
await page.waitForTimeout(500);
check('la sesión aparece en el día', (await page.locator('.day-item').count()) === 1);

await page.locator('.fab').click();
await page.waitForTimeout(400);
await campo('Paciente').selectOption({ index: 2 });
await campo('Hora').fill('16:00');
await campo('Repetir').selectOption('semanal');
await campo('¿Cuántas sesiones?').fill('4');
await page.waitForTimeout(400);
const aviso = await page.locator('.modal .banner.info').textContent();
check('avisa cuántas sesiones va a crear', /4 sesiones/.test(aviso ?? ''), aviso?.replace(/\s+/g, ' ').trim());
await page.getByRole('button', { name: 'Guardar' }).click();
await page.waitForTimeout(600);

const totalSesiones = await page.evaluate(() => JSON.parse(localStorage.getItem('pipicucu:data')).sessions.length);
check('quedan 5 sesiones (1 suelta + serie de 4)', totalSesiones === 5, `hay ${totalSesiones}`);

titulo('6. Cierre del día');
// Se cierra desde Inicio, que es donde se entra al terminar de atender, en vez
// de ir a buscar el día de hoy en el calendario.
await page.locator('.tabbar button', { hasText: 'Inicio' }).click();
await page.waitForTimeout(500);
check('el inicio ofrece el cierre del día', (await page.locator('.close-day-btn').count()) === 1);
check('el cierre del inicio cuenta las de hoy', (await page.locator('.close-day-btn .badge').innerText()) === '2');
check('el cartel del cierre lleva la luna', (await page.locator('.close-day-btn').innerText()).includes('🌙'));
await page.locator('.close-day-btn').click();
await page.waitForTimeout(500);
const filas = await page.locator('.close-row').count();
check('ofrece cerrar las sesiones de hoy', filas === 2, `${filas} pendientes`);
await page.locator('.close-row').first().locator('.seg button', { hasText: 'Vino' }).click();
await page.locator('.close-row').first().locator('input[type=checkbox]').check();
await page.locator('.close-row').nth(1).locator('.seg button', { hasText: 'Faltó' }).click();
await page.waitForTimeout(400);
await page.getByRole('button', { name: /Guardar/ }).click();
await page.waitForTimeout(700);

const trasCierre = await page.evaluate(() => {
  const d = JSON.parse(localStorage.getItem('pipicucu:data'));
  return { realizadas: d.sessions.filter((s) => s.status === 'realizada').length,
           ausentes: d.sessions.filter((s) => s.status === 'ausente').length,
           pagos: d.payments.length, importe: d.payments[0]?.amount };
});
check('marcó una como realizada', trasCierre.realizadas === 1);
check('marcó una como ausente', trasCierre.ausentes === 1);
check('creó el cobro de la realizada', trasCierre.pagos === 1);
check('el cobro usa el honorario con centavos', trasCierre.importe === 4250050, `${trasCierre.importe} centavos`);
// El cartel no se va: baja la voz. Así se ve de un vistazo que el día quedó
// resuelto, en vez de tener que acordarse de que el botón estaba y ya no.
check('cerrado el día, el cartel baja la voz', (await page.locator('.close-day-btn.is-quiet').count()) === 1);
check('y dice que el día está cerrado', (await page.locator('.close-day-btn').innerText()).includes('Día cerrado'));

titulo('7. Persistencia tras recargar');
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await saltarBienvenida();
await page.waitForTimeout(400);
await page.locator('.tabbar button', { hasText: 'Pacientes' }).click();
await page.waitForTimeout(500);
await page.locator('.patient-card').filter({ has: page.locator('.patient-name', { hasText: 'Ana Gómez' }) })
  .getByRole('button', { name: 'Editar' }).click();
await page.waitForTimeout(400);

// Al editar a alguien que ya tiene esos datos, los bloques se abren solos:
// esconder justo lo que se vino a cambiar sería peor que mostrarlo de más.
check(
  'al editar, los plegables con datos ya vienen abiertos',
  (await page.locator('.modal details.plegable[open]').count()) === 2,
  `${await page.locator('.modal details.plegable[open]').count()} de 2`,
);

const leido = {
  nombre: await campo('Nombre y apellido').inputValue(),
  email: await campo('Email').inputValue(),
  tel: await campo('Teléfono').inputValue(),
  honorario: await campo('Honorario por sesión').inputValue(),
  tipo: await campo('Tipo').inputValue(),
  frecuencia: await campo('Frecuencia').inputValue(),
  completo: await campo('Nombre completo').inputValue(),
  dni: await campo('DNI').inputValue(),
  cuit: await campo('CUIT / CUIL').inputValue(),
  iva: await campo('Condición frente al IVA').inputValue(),
  os: await campo('Obra social / prepaga').inputValue(),
  afiliado: await campo('N.º de afiliado').inputValue(),
  notas: await campo('Notas').inputValue(),
};
for (const [k, esperado] of Object.entries({ ...P1, estado: undefined })) {
  if (esperado === undefined) continue;
  check(`sobrevive "${k}"`, leido[k] === esperado, `guardó "${leido[k]}"`);
}
await page.getByRole('button', { name: 'Cancelar' }).click();
await page.waitForTimeout(300);

titulo('8. Exportar, borrar todo, importar');
const antes = await page.evaluate(() => localStorage.getItem('pipicucu:data'));
await page.locator('.tabbar button', { hasText: 'Ajustes' }).click();
await page.waitForTimeout(400);
const descarga = page.waitForEvent('download');
await page.getByRole('button', { name: /Exportar copia/ }).click();
const archivo = await descarga;
const ruta = await archivo.path();
// Una copia vacía es peor que ninguna: uno la guarda y se entera de que no
// tenía nada el día que la necesita.
check('la copia avisa qué se llevó',
  /Copia guardada: \d+ paciente/.test(await page.locator('.card', { hasText: 'Copia de seguridad' }).locator('p.small').last().innerText()),
  await page.locator('.card', { hasText: 'Copia de seguridad' }).locator('p.small').last().innerText());
check('descarga el archivo de respaldo', archivo.suggestedFilename().startsWith('pipi-cucu-'), archivo.suggestedFilename());

await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await saltarBienvenida();
check('tras borrar, la app queda vacía', await page.locator('.empty strong', { hasText: 'Tu agenda, pipí cucú.' }).isVisible());

await page.locator('.tabbar button', { hasText: 'Ajustes' }).click();
await page.waitForTimeout(400);
page.once('dialog', (d) => d.accept());
await page.locator('input[type=file]').setInputFiles(ruta);
await page.waitForTimeout(1200);

const despues = await page.evaluate(() => localStorage.getItem('pipicucu:data'));
const a = JSON.parse(antes), b = JSON.parse(despues);
check('vuelven los 2 pacientes', b.patients.length === 2);
check('vuelven las 5 sesiones', b.sessions.length === 5);
check('vuelve el pago', b.payments.length === 1);
check('los pacientes son idénticos', mismosDatos(a.patients, b.patients));
check('las sesiones son idénticas', mismosDatos(a.sessions, b.sessions));
check('los pagos son idénticos', mismosDatos(a.payments, b.payments));
check('los ajustes son idénticos', mismosDatos(a.settings, b.settings));

titulo('9. Las pantallas muestran los datos recuperados');
await page.locator('.tabbar button', { hasText: 'Inicio' }).click();
await page.waitForTimeout(600);
const heroe = await page.locator('.hero-value').textContent();
check('el inicio muestra lo cobrado', heroe?.includes('42.500,50'), heroe?.trim());

await page.locator('.tabbar button', { hasText: 'Finanzas' }).click();
await page.waitForTimeout(400);
await page.locator('.tabs button', { hasText: 'Monitoreo' }).click();
await page.waitForTimeout(600);
check('el monitoreo dibuja las barras', (await page.locator('.sbar-seg').count()) > 0);

await page.locator('.tabs button', { hasText: 'Facturación' }).click();
await page.waitForTimeout(600);
await page.locator('.bill-item').first().click();
await page.waitForTimeout(500);
const texto = await page.locator('.bill-text').inputValue();
check('el texto de factura usa el nombre completo', texto.includes('Ana Laura Gómez Sosa'));
check('el texto de factura usa el afiliado', texto.includes('SM-99/04'));

await page.locator('.tabs button', { hasText: 'Resumen' }).click();
await page.waitForTimeout(500);
// Decía "Diferencia del mes: $ 0", que con todo cobrado se lee como si no
// hubiera registrado el pago.
const porCobrar = await page.locator('.stat').filter({ hasText: 'Por cobrar del mes' }).innerText();
check('lo que queda por cobrar se dice con palabras, no con un cero',
  !porCobrar.includes('$ 0'), porCobrar.replace(/\n/g, ' | '));

titulo('10. La ficha del paciente dice qué es cada número');
await page.locator('.tabbar button', { hasText: 'Pacientes' }).click();
await page.waitForTimeout(500);
// Los pacientes se agrupan por tipo. Con un solo tipo cargado no hay rótulo:
// sería un encabezado que no distingue nada.
const grupos = await page.locator('.grupo-pacientes').count();
check('los pacientes se listan agrupados', grupos >= 1, `${grupos} grupo(s)`);
const rotulos = await page.locator('.grupo-titulo').allInnerTexts();
check('con un solo tipo no aparece el rótulo', rotulos.length === 0 || grupos > 1, rotulos.join(' | ') || '(sin rótulos)');

// Sin fijarse en cuál ficha es: agrupar por tipo cambia el orden, y una
// comprobación atada a "la primera" se rompe sola.
const fichas = (await page.locator('.patient-stats').allInnerTexts()).map((t) => t.replace(/\n/g, ' '));
check('las fichas muestran lo cobrado', fichas.every((f) => f.includes('cobrado')), fichas.length + ' ficha(s)');
// El saldo en cero decía "$ 0", que con el paciente al día se lee como si no
// hubiera contado el cobro.
check('ninguna ficha muestra "$ 0" como saldo', !fichas.some((f) => /\$ 0 (al día|sin saldo)/.test(f)), fichas.join(' // '));
check('el saldo en cero se dice con palabras', fichas.some((f) => f.includes('Al día')), fichas.join(' // '));

titulo('11. El perro del pie');
await page.locator('.tabbar button', { hasText: 'Inicio' }).click();
await page.waitForTimeout(400);
const perro = page.locator('.footer-dog img').first();
check('el pie está en todas las secciones', (await page.locator('.app-footer').count()) === 1);
check('es el mismo perro que la portada', (await perro.getAttribute('src')) === '/pipi-cucu-dog-static.png');
check('al abrir no hay ningún mensaje', (await page.locator('.footer-bubble').count()) === 0);
await page.locator('.footer-dog').first().click();
await page.waitForTimeout(300);
check('al tocarlo vuela', (await perro.getAttribute('src')) === '/pipi-cucu-dog-flying.gif');
check('al tocarlo aparece el mensaje', (await page.locator('.footer-bubble').count()) === 1);
const mensajeAntes = await page.locator('.footer-bubble').first().innerText();
await page.locator('.footer-dog').first().click();
await page.waitForTimeout(300);
check('al tocarlo de nuevo cambia el mensaje', (await page.locator('.footer-bubble').first().innerText()) !== mensajeAntes);
// Que no repita dos veces seguidas es lo que hace que valga la pena seguir
// tocándolo; que haya variedad es lo que lo hace un hallazgo y no un cartel.
const frases = [];
let repitioSeguida = false;
for (let i = 0; i < 30; i++) {
  await page.locator('.footer-dog').first().click();
  await page.waitForTimeout(60);
  const f = await page.locator('.footer-bubble').first().innerText();
  if (f === frases[frases.length - 1]) repitioSeguida = true;
  frases.push(f);
}
check('nunca repite la misma dos veces seguidas', !repitioSeguida);
check('hay variedad de frases', new Set(frases).size >= 12, `${new Set(frases).size} distintas en 30 toques`);
await page.waitForTimeout(2800);
check('después se queda quieto de nuevo', (await perro.getAttribute('src')) === '/pipi-cucu-dog-static.png');

titulo('12. La guía y los carteles');
await page.locator('.tabbar button', { hasText: 'Ajustes' }).click();
await page.waitForTimeout(300);
const avisoSync = await page.locator('.card', { hasText: 'Por qué no se sincroniza' }).innerText();
check('Ajustes explica por qué no se sincroniza', avisoSync.includes('un dispositivo por vez'));
check('y avisa que importar reemplaza', avisoSync.includes('reemplaza'));
check('el pie dice el eslogan', (await page.locator('.footer-slogan').innerText()) === 'Tu agenda, Pipí Cucú');
await page.locator('.ayuda').click();
await page.waitForTimeout(400);
check('el signo de pregunta abre la guía', (await page.locator('.guia').count()) === 1);
// Que no se sincronice es una decisión, no una función que falta. Sin el
// porqué escrito, se lee como lo segundo.
const textoGuia = await page.locator('.guia').innerText();
check('la guía explica por qué no se sincroniza', textoGuia.includes('un dispositivo por vez'), '');
// Por título y no por cantidad: sumar una sección no tiene por qué romper la
// prueba, pero perder una sí.
const titulosGuia = await page.locator('.guia-bloque h3').allInnerTexts();
for (const t of ['Para no tener que acordarte', 'Pacientes', 'Agenda', 'Finanzas', 'Ajustes y tu copia de seguridad', 'Detalles']) {
  check(`la guía tiene la sección "${t}"`, titulosGuia.includes(t), titulosGuia.join(' / '));
}
check('la guía cuenta que todo se puede deshacer', textoGuia.includes('se puede deshacer'), '');
const guiaTxt = await page.locator('.guia').innerText();
check('la guía avisa que hay que hacer copia', guiaTxt.toLowerCase().includes('export'));
await page.locator('.guia .btn').click();
await page.waitForTimeout(400);
check('desde la guía vuelven los carteles', (await page.locator('.tour-cartel').count()) === 1);
const pasos = [];
for (let i = 0; i < 5; i++) {
  pasos.push(await page.locator('.tour-cartel h2').innerText());
  check(`el cartel ${i + 1} señala un botón real`, (await page.locator('.tour-aro').count()) === 1);
  const sig = page.locator('.tour-acciones .btn');
  if (!(await sig.count())) break;
  await sig.click();
  await page.waitForTimeout(200);
}
check('son cinco carteles distintos', new Set(pasos).size === 5, pasos.length + '');
await page.locator('.tour-saltar').click();
await page.waitForTimeout(300);
check('al terminar los carteles se van', (await page.locator('.tour').count()) === 0);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(600);
check('los carteles no vuelven solos', (await page.locator('.tour').count()) === 0);

titulo('13. Planillas para Excel');
await page.locator('.tabbar button', { hasText: 'Ajustes' }).click();
await page.waitForTimeout(500);
for (const [boton, cabecera] of [['Sesiones (.csv)', 'Fecha;Hora;Paciente'], ['Cobros (.csv)', 'Fecha;Paciente;Importe']]) {
  const [bajada] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: boton }).click(),
  ]);
  const ruta = `${SC}/${bajada.suggestedFilename()}`;
  await bajada.saveAs(ruta);
  const txt = readFileSync(ruta, 'utf8');
  check(`baja la planilla de ${boton}`, bajada.suggestedFilename().endsWith('.csv'), bajada.suggestedFilename());
  // Sin el BOM, Excel lee el archivo como Latin-1 y rompe todos los acentos.
  check('lleva el BOM que necesita Excel', txt.charCodeAt(0) === 0xfeff);
  check('separa con punto y coma', txt.includes(cabecera), cabecera);
  check('escribe la fecha con año', /\d{2}\/\d{2}\/\d{4}/.test(txt));
}
const planillaCobros = readFileSync(`${SC}/pipi-cucu-cobros-${new Date().toISOString().slice(0, 10)}.csv`, 'utf8');
check('los importes usan coma decimal, que es lo que Excel suma', planillaCobros.includes('42500,50'), 
  planillaCobros.split('\r\n')[1] ?? '');

titulo('14. Tema claro y oscuro');
await page.locator('.tabbar button', { hasText: 'Ajustes' }).click();
await page.waitForTimeout(400);
await page.getByRole('button', { name: /Oscuro/ }).click();
await page.waitForTimeout(400);
check('el modo oscuro se aplica', (await page.evaluate(() => document.documentElement.dataset.tema)) === 'oscuro');
// La barra del navegador tiene que acompañar, o queda una franja clara arriba.
check('la barra del navegador acompaña',
  (await page.evaluate(() => document.querySelector('meta[name="theme-color"]').content)) === '#1a1533');
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await saltarBienvenida();
check('el tema sobrevive a recargar', (await page.evaluate(() => document.documentElement.dataset.tema)) === 'oscuro');
// El texto tiene que seguir leyéndose: en oscuro, un color fijo de modo claro
// deja letra clara sobre fondo claro.
await page.locator('.tabbar button', { hasText: 'Ajustes' }).click();
await page.waitForTimeout(400);
await page.getByRole('button', { name: /Claro/ }).click();
await page.waitForTimeout(400);
check('se puede volver al claro', (await page.evaluate(() => document.documentElement.dataset.tema)) === 'claro');

// El ajuste de animaciones del sistema se prende sin querer —el ahorro de
// batería de Android lo hace solo— y desde la app nadie puede adivinar por qué
// se quedó todo quieto. Por eso se puede decidir acá también.
await page.getByRole('button', { name: 'Nunca' }).click();
await page.waitForTimeout(300);
check('se pueden apagar las animaciones', (await page.evaluate(() => document.documentElement.dataset.animaciones)) === 'nunca');
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(500);
check('con las animaciones apagadas el perro de la portada está quieto',
  (await page.evaluate(() => {
    const d = document.querySelector('.welcome-dog');
    return d ? getComputedStyle(d).content.includes('dog-static') : false;
  })));
await saltarBienvenida();
await page.locator('.tabbar button', { hasText: 'Ajustes' }).click();
await page.waitForTimeout(400);
await page.getByRole('button', { name: 'Según el sistema' }).click();
await page.waitForTimeout(300);
check('y se puede volver a dejárselo al sistema', (await page.evaluate(() => document.documentElement.dataset.animaciones)) === 'auto');

titulo('15. Migración de datos de la versión anterior');
// Lo que más importa de este cambio: que a quien ya venía usando la app no se
// le pierda nada al abrirla después de actualizar.
// Se guarda lo que había para devolverlo al final: las secciones siguientes
// cuentan con esos datos.
const respaldoReal = await page.evaluate(() => localStorage.getItem('pipicucu:data'));
await page.evaluate(() => {
  localStorage.setItem('pipicucu:data', JSON.stringify({
    version: 1,
    patients: [{ id: 'viejo1', name: 'Paciente De Antes', email: '', phone: '', defaultFee: 700000,
      status: 'activo', colorIndex: 1, frequency: 'semanal', kind: 'particular', legalName: '',
      taxId: '', taxCondition: 'consumidor_final', memberId: '', notes: 'nota que no se puede perder',
      createdAt: '2025-06-01', lastRaise: null }],
    sessions: [{ id: 'vs1', patientId: 'viejo1', date: '2026-03-10', time: '09:00', durationMin: 50,
      status: 'realizada', fee: 700000, chargeable: true, notes: '' }],
    payments: [{ id: 'vg1', patientId: 'viejo1', date: '2026-03-10', amount: 700000,
      method: 'efectivo', notes: '' }],
    settings: { currency: '$' },
  }));
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(700);
await saltarBienvenida();
const migrado = await page.evaluate(() => JSON.parse(localStorage.getItem('pipicucu:data')));
check('el paciente viejo sigue estando', migrado.patients.length === 1 && migrado.patients[0].name === 'Paciente De Antes');
check('su nota no se perdió', migrado.patients[0].notes === 'nota que no se puede perder');
check('la sesión y el pago siguen estando', migrado.sessions.length === 1 && migrado.payments.length === 1);
check('ahora todo lleva su sello', [migrado.patients[0], migrado.sessions[0], migrado.payments[0]].every((r) => typeof r.updatedAt === 'string' && r.updatedAt.length > 10));
check('quedaron las listas de borrados', migrado.deleted && Array.isArray(migrado.deleted.patients));
check('subió la versión del esquema', migrado.version === 2, `versión ${migrado.version}`);
// Y que la app siga andando con esos datos migrados, no solo que el JSON esté bien.
await page.locator('.tabbar button', { hasText: 'Pacientes' }).click();
await page.waitForTimeout(500);
check('la app muestra los datos migrados', (await page.locator('.patient-card').count()) === 1);

// Devolver los datos de verdad, que es con los que siguen las pruebas de abajo.
await page.evaluate((r) => localStorage.setItem('pipicucu:data', r), respaldoReal);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await saltarBienvenida();

titulo('16. Sin conexión');
await ctx.setOffline(true);
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(1200);
await saltarBienvenida();
check('la app carga sin internet', (await page.locator('.brand').count()) === 1);
const patsOffline = await page.evaluate(() => JSON.parse(localStorage.getItem('pipicucu:data')).patients.length);
check('los datos siguen ahí sin internet', patsOffline === 2);
await ctx.setOffline(false);

console.log(`\n═══ ${ok} verificaciones pasaron, ${fail} fallaron ═══`);
console.log('Errores de JavaScript:', errs.length ? errs : 'ninguno');
await browser.close();
process.exit(fail > 0 ? 1 : 0);
