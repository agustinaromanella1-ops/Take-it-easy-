/**
 * Sirve la app compilada y el servicio para compartir, en el mismo origen,
 * como lo hace el Worker de Cloudflare. El almacenamiento es memoria: se
 * pierde al cortar. Es para probar, no para usar de verdad.
 *
 *   npm run build && node scripts/servidor-local.mjs --puerto 4175
 *   node scripts/servidor-local.mjs --sin-almacen    # simula "sin configurar"
 *
 * Con `--ver-almacen` expone /__almacen con lo guardado tal cual, para que
 * las pruebas comprueben que el servidor solo tiene bloques ilegibles. El
 * Worker de verdad no tiene eso.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { manejar } from '../server/compartir.js';

const args = process.argv.slice(2);
const puerto = Number(args[args.indexOf('--puerto') + 1] ?? 4175) || 4175;
const sinAlmacen = args.includes('--sin-almacen');
const verAlmacen = args.includes('--ver-almacen');
const raiz = fileURLToPath(new URL('../dist/', import.meta.url));

const memoria = new Map();
const almacen = {
  async get(k) {
    return memoria.get(k) ?? null;
  },
  async put(k, v) {
    memoria.set(k, v);
  },
  async delete(k) {
    memoria.delete(k);
  },
};

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.wasm': 'application/wasm',
  '.gz': 'application/gzip',
};

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${puerto}`);
  if (verAlmacen && url.pathname === '/__almacen') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify([...memoria.values()]));
    return;
  }
  if (url.pathname.startsWith('/api/')) {
    const cuerpo = await new Promise((ok) => {
      const partes = [];
      req.on('data', (c) => partes.push(c));
      req.on('end', () => ok(Buffer.concat(partes)));
    });
    const r = await manejar(
      new Request(url, { method: req.method, headers: req.headers, ...(cuerpo.length ? { body: cuerpo } : {}) }),
      sinAlmacen ? undefined : almacen,
    );
    res.writeHead(r.status, Object.fromEntries(r.headers));
    res.end(Buffer.from(await r.arrayBuffer()));
    return;
  }
  let ruta = normalize(join(raiz, decodeURIComponent(url.pathname)));
  if (!ruta.startsWith(raiz)) ruta = join(raiz, 'index.html');
  let contenido;
  try {
    contenido = await readFile(ruta);
  } catch {
    // Como `not_found_handling: single-page-application`: toda ruta es la app.
    ruta = join(raiz, 'index.html');
    contenido = await readFile(ruta);
  }
  res.writeHead(200, { 'content-type': TIPOS[extname(ruta)] ?? 'application/octet-stream' });
  res.end(contenido);
}).listen(puerto, () => console.log(`Salchi en http://localhost:${puerto}${sinAlmacen ? ' (sin almacenamiento)' : ''}`));
