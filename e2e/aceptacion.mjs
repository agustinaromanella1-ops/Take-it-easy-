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

const campo = (etiqueta) => page.locator('.modal .field').filter({ hasText: etiqueta }).locator('input, select, textarea').first();

await page.goto(process.env.URL ?? 'http://localhost:4173/', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(700);

titulo('1. Arranque limpio');
check('la app abre vacía', await page.getByText('Tu agenda, pipí cucú').isVisible());

titulo('2. Alta de paciente con TODOS los campos');
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

titulo('3. Agenda: sesión suelta y serie recurrente');
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

titulo('4. Cierre del día');
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

titulo('5. Persistencia tras recargar');
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await page.locator('.tabbar button', { hasText: 'Pacientes' }).click();
await page.waitForTimeout(500);
await page.locator('.patient-card').filter({ has: page.locator('.patient-name', { hasText: 'Ana Gómez' }) })
  .getByRole('button', { name: 'Editar' }).click();
await page.waitForTimeout(400);

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

titulo('6. Exportar, borrar todo, importar');
const antes = await page.evaluate(() => localStorage.getItem('pipicucu:data'));
await page.locator('.tabbar button', { hasText: 'Ajustes' }).click();
await page.waitForTimeout(400);
const descarga = page.waitForEvent('download');
await page.getByRole('button', { name: /Exportar copia/ }).click();
const archivo = await descarga;
const ruta = await archivo.path();
check('descarga el archivo de respaldo', archivo.suggestedFilename().startsWith('pipi-cucu-'), archivo.suggestedFilename());

await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(800);
check('tras borrar, la app queda vacía', await page.getByText('Tu agenda, pipí cucú').isVisible());

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

titulo('7. Las pantallas muestran los datos recuperados');
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

titulo('8. Sin conexión');
await ctx.setOffline(true);
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(1500);
check('la app carga sin internet', (await page.locator('.brand').count()) === 1);
const patsOffline = await page.evaluate(() => JSON.parse(localStorage.getItem('pipicucu:data')).patients.length);
check('los datos siguen ahí sin internet', patsOffline === 2);
await ctx.setOffline(false);

console.log(`\n═══ ${ok} verificaciones pasaron, ${fail} fallaron ═══`);
console.log('Errores de JavaScript:', errs.length ? errs : 'ninguno');
await browser.close();
process.exit(fail > 0 ? 1 : 0);
