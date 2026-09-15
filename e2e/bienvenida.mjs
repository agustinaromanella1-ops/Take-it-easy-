/**
 * Verificación de la pantalla de bienvenida contra el diseño aprobado.
 *
 * No compara "se parece": mide en la pantalla renderizada la caja de tinta de
 * cada pieza (el rectángulo que ocupan los píxeles que no son cielo ni nube) y
 * la contrasta con la misma medición hecha sobre
 * src/assets/pipi-cucu-welcome-reference.png. Los números de OBJETIVO salen de
 * medir esa imagen, no de estimarlos.
 *
 *   npx vite build && npx vite preview --port 4173 &
 *   node e2e/bienvenida.mjs
 */
import pkg from 'playwright';
const { chromium } = pkg;

const URL = process.env.URL ?? 'http://localhost:4173/';
const SC = process.env.SC ?? '/tmp';

/* Medidas del diseño, en % del escenario (941 x 1671). izq/ancho van sobre el
   ancho; arriba/alto sobre el alto. */
const OBJETIVO = {
  kicker:   { izq: 17.22, ancho: 65.36, arriba: 20.47, alto: 2.45 },
  wordmark: { izq: 11.58, ancho: 77.26, arriba: 25.91, alto: 10.35 },
  tagline:  { izq: 23.80, ancho: 52.82, arriba: 37.76, alto: 3.05 },
  perro:    { izq: 17.85, ancho: 71.84, arriba: 47.58, alto: 13.88 },
  boton:    { izq: 13.39, ancho: 73.33, arriba: 70.68, alto: 7.66 },
  botonTexto: { izq: 37.62, ancho: 25.08, arriba: 73.25, alto: 3.17 },
};

const TOL_ANCHO = 2.5;  // puntos porcentuales
const TOL_POS = 1.5;

/** El logo de apertura tapa todo por ~1,6 s: se saltea tocándolo. */
async function saltarSplash(page) {
  const splash = page.locator('.splash');
  if (await splash.count()) {
    await splash.click({ force: true }).catch(() => {});
    await splash.waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
  }
}

let ok = 0, fail = 0;
function check(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`   ✓ ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { fail++; console.log(`   ✗ FALLA: ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}

/** Caja de tinta de un elemento, en % del escenario. */
async function tinta(page, sel) {
  return page.evaluate((sel) => {
    const stage = document.querySelector('.welcome-stage');
    const el = document.querySelector(sel);
    if (!stage || !el) return null;
    const s = stage.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return {
      izq: (r.left - s.left) / s.width * 100,
      ancho: r.width / s.width * 100,
      arriba: (r.top - s.top) / s.height * 100,
      alto: r.height / s.height * 100,
    };
  }, sel);
}

/** Caja de tinta real (píxeles dibujados) de una franja, midiendo la captura. */
async function tintaPintada(page, franja) {
  const buf = await page.locator('.welcome-stage').screenshot();
  return page.evaluate(async ({ b64, franja }) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const W = img.naturalWidth, H = img.naturalHeight;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, W, H).data;
    const y0 = Math.round(franja[0] / 100 * H), y1 = Math.round(franja[1] / 100 * H);
    let ix0 = W, iy0 = H, ix1 = -1, iy1 = -1;
    for (let y = y0; y <= y1; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4, R = d[i], G = d[i + 1], B = d[i + 2];
      // cielo y nubes quedan afuera; lo demás es tinta. La segunda condición
      // descarta el blanco tirando a cálido del borde de las nubes, que si no
      // se cuenta como dibujo y agranda la caja.
      if (B >= 190 && B >= R - 4) continue;
      if (R >= 225 && G >= 225 && B >= 220) continue;
      if (x < ix0) ix0 = x; if (x > ix1) ix1 = x;
      if (y < iy0) iy0 = y; if (y > iy1) iy1 = y;
    }
    if (ix1 < 0) return null;
    return {
      izq: ix0 / W * 100, ancho: (ix1 - ix0 + 1) / W * 100,
      arriba: iy0 / H * 100, alto: (iy1 - iy0 + 1) / H * 100,
    };
  }, { b64: buf.toString('base64'), franja });
}

/** Caja de la tinta blanca dentro del botón: sirve para medir la palabra.
    Se mira solo el interior del botón, sin sus esquinas redondeadas, para que
    no se cuele el blanco de una nube. */
async function tintaClara(page, franja, columnas) {
  const buf = await page.locator('.welcome-stage').screenshot();
  return page.evaluate(async ({ b64, franja, columnas }) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const W = img.naturalWidth, H = img.naturalHeight;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, W, H).data;
    const y0 = Math.round(franja[0] / 100 * H), y1 = Math.round(franja[1] / 100 * H);
    const x0 = Math.round(columnas[0] / 100 * W), x1 = Math.round(columnas[1] / 100 * W);
    let ix0 = W, iy0 = H, ix1 = -1, iy1 = -1;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = (y * W + x) * 4, R = d[i], G = d[i + 1], B = d[i + 2];
      if (!(R > 245 && G > 245 && B > 240)) continue;
      if (x < ix0) ix0 = x; if (x > ix1) ix1 = x;
      if (y < iy0) iy0 = y; if (y > iy1) iy1 = y;
    }
    if (ix1 < 0) return null;
    return {
      izq: ix0 / W * 100, ancho: (ix1 - ix0 + 1) / W * 100,
      arriba: iy0 / H * 100, alto: (iy1 - iy0 + 1) / H * 100,
    };
  }, { b64: buf.toString('base64'), franja, columnas });
}

function comparar(nombre, medido, meta) {
  if (!medido) { check(`${nombre}: se encontró en pantalla`, false); return; }
  const f = (n) => n.toFixed(2) + '%';
  check(`${nombre}: ancho`, Math.abs(medido.ancho - meta.ancho) <= TOL_ANCHO,
    `${f(medido.ancho)} vs ${f(meta.ancho)} del diseño`);
  check(`${nombre}: posición horizontal`, Math.abs(medido.izq - meta.izq) <= TOL_POS,
    `${f(medido.izq)} vs ${f(meta.izq)}`);
  check(`${nombre}: posición vertical`, Math.abs(medido.arriba - meta.arriba) <= TOL_POS,
    `${f(medido.arriba)} vs ${f(meta.arriba)}`);
}

const PANTALLAS = [
  { nombre: 'iphone-se', w: 375, h: 667 },
  { nombre: 'iphone-14', w: 390, h: 844 },
  { nombre: 'pixel-7', w: 412, h: 915 },
  { nombre: 'escritorio', w: 1280, h: 800 },
];

const browser = await chromium.launch();

console.log('\n1. Proporciones contra el diseño aprobado (390 x 844)');
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(URL);
  await saltarSplash(page);
  await page.waitForSelector('.welcome-stage');
  await page.waitForTimeout(400);

  // franjas donde buscar la tinta de cada pieza, en % del escenario
  comparar('Título chico', await tintaPintada(page, [16, 24]), OBJETIVO.kicker);
  comparar('Nombre Pipí Cucú', await tintaPintada(page, [24.2, 37]), OBJETIVO.wordmark);
  comparar('Eslogan', await tintaPintada(page, [37, 42]), OBJETIVO.tagline);
  comparar('Perro', await tintaPintada(page, [43, 66]), OBJETIVO.perro);
  comparar('Botón Empezar', await tinta(page, '.welcome-cta'), OBJETIVO.boton);
  comparar('Palabra Empezar', await tintaClara(page, [71.2, 77.8], [16, 84]), OBJETIVO.botonTexto);
  // Debajo del botón no va nada: el diseño traía un "Ya tengo una cuenta" que
  // se sacó porque la app no tiene cuentas.
  check('Debajo del botón no queda nada suelto', (await tintaPintada(page, [79.5, 88])) === null);
  await page.close();
}

console.log('\n2. Entra en pantalla sin scroll y los controles se pueden tocar');
for (const p of PANTALLAS) {
  const page = await browser.newPage({ viewport: { width: p.w, height: p.h } });
  await page.goto(URL);
  await saltarSplash(page);
  await page.waitForSelector('.welcome-stage');
  await page.waitForTimeout(300);
  const r = await page.evaluate(() => {
    const de = document.documentElement;
    const cta = document.querySelector('.welcome-cta').getBoundingClientRect();
    const stage = document.querySelector('.welcome-stage').getBoundingClientRect();
    return {
      scroll: de.scrollHeight > de.clientHeight + 1 || de.scrollWidth > de.clientWidth + 1,
      cta: { w: cta.width, h: cta.height },
      dentro: stage.top >= -0.5 && stage.bottom <= de.clientHeight + 0.5,
      // el unico <img> de la pantalla es el perro; los dos <svg> son las gotas
      perros: document.querySelectorAll('.welcome img').length,
      gotas: document.querySelectorAll('.welcome .wm-gota').length,
    };
  });
  await page.screenshot({ path: `${SC}/bienvenida-${p.nombre}.png` });
  check(`${p.nombre}: sin scroll`, !r.scroll);
  check(`${p.nombre}: el diseño entra completo`, r.dentro);
  check(`${p.nombre}: botón ≥ 44px`, r.cta.h >= 43.5 && r.cta.w >= 44, `${r.cta.w.toFixed(0)}x${r.cta.h.toFixed(0)}`);
  check(`${p.nombre}: un solo perro`, r.perros === 1, `${r.perros}`);
  check(`${p.nombre}: las dos gotas`, r.gotas === 2, `${r.gotas}`);
  await page.close();
}

console.log('\n3. Empezar lleva a la app');
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(URL);
  await saltarSplash(page);
  await page.waitForSelector('.welcome-cta');
  await page.click('.welcome-cta');
  await page.waitForTimeout(300);
  check('Empezar entra a la app', (await page.locator('.welcome').count()) === 0);
  await page.reload();
  await saltarSplash(page);
  await page.waitForTimeout(300);
  check('La bienvenida no vuelve a aparecer', (await page.locator('.welcome').count()) === 0);
  await page.close();
}
console.log('\n4. Menos movimiento: el perro queda quieto');
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await page.goto(URL);
  await saltarSplash(page);
  await page.waitForSelector('.welcome-dog');
  await page.waitForTimeout(400);
  const quieto = await page.evaluate(() => {
    const cs = getComputedStyle(document.querySelector('.welcome-dog'));
    return cs.content.includes('dog-static');
  });
  check('Se usa el fotograma fijo, no el GIF', quieto);
  await page.screenshot({ path: `${SC}/bienvenida-sin-movimiento.png` });
  await page.close();
}

await browser.close();
console.log(`\n${ok} bien, ${fail} mal`);
process.exit(fail ? 1 : 0);
