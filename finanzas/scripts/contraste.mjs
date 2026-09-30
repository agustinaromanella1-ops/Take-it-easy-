/**
 * Mide el contraste de cada par de texto y fondo de los dos temas contra WCAG
 * AA (4,5:1 para texto; 3:1 para bordes de controles). Lee los tokens de
 * src/styles.css, así que mide lo que de verdad se usa.
 *
 *   node scripts/contraste.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'styles.css'), 'utf8');

function tokens(selector) {
  const i = css.indexOf(selector + ' {');
  const bloque = css.slice(i, css.indexOf('}', i));
  return Object.fromEntries([...bloque.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]));
}

function luminancia(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a, b) {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

// [texto, fondo, mínimo]
const PARES = [
  ['tinta', 'fondo', 4.5],
  ['tinta', 'superficie', 4.5],
  ['tinta', 'menta', 4.5],
  ['tinta-suave', 'fondo', 4.5],
  ['tinta-suave', 'superficie', 4.5],
  ['tinta-suave', 'menta', 4.5],
  ['verde', 'fondo', 4.5],
  ['verde', 'superficie', 4.5],
  ['verde', 'menta', 4.5],
  ['sobre-verde', 'verde', 4.5],
  ['sobre-verde', 'verde-fuerte', 4.5],
  ['aviso-tinta', 'aviso-fondo', 4.5],
  ['error-tinta', 'error-fondo', 4.5],
  ['error-tinta', 'superficie', 4.5],
  ['info-tinta', 'info-fondo', 4.5],
  ['fondo', 'tinta', 4.5],
  ['tinta', 'superficie-2', 4.5],
  ['borde-fuerte', 'superficie', 3],
  ['foco', 'fondo', 3],
  ['almohadilla-llena', 'superficie', 3],
];

let mal = 0;
for (const [nombre, sel] of [['claro', ':root'], ['oscuro', ":root[data-tema='oscuro']"]]) {
  const claro = tokens(':root');
  const t = { ...claro, ...(sel === ':root' ? {} : tokens(sel)) };
  console.log(`\nTema ${nombre}`);
  for (const [a, b, min] of PARES) {
    const r = contraste(t[a], t[b]);
    const ok = r >= min;
    if (!ok) mal++;
    console.log(`  ${ok ? '✓' : '✗'} ${a} sobre ${b}: ${r.toFixed(2).replace('.', ',')}:1 (mín. ${min})`);
  }
}
if (mal) {
  console.log(`\n${mal} pares no pasan.`);
  process.exit(1);
}
console.log('\nTodos los pares pasan.');
