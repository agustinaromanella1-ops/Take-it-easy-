/**
 * El servicio para compartir con una persona de confianza.
 *
 * Guarda bloques cifrados en el teléfono de quien comparte. Nunca recibe la
 * clave (viaja en el "#" del enlace, que el navegador no manda), así que no
 * puede leer nada: ni montos, ni nombres, ni quién es quién. Tampoco registra
 * nada: no hay logs de contenido ni analítica.
 *
 * Contrato:
 *   GET    /api/compartidos/salud  → { servicio: 'salchi-compartir' }
 *   POST   /api/compartidos        { cifrado } → { id, token }
 *   GET    /api/compartidos/:id    → { cifrado } | 404
 *   PUT    /api/compartidos/:id    Authorization: Bearer token, { cifrado } → 204
 *   DELETE /api/compartidos/:id    Authorization: Bearer token → 204
 *
 * El token solo lo tiene el teléfono que compartió; el servidor guarda su
 * hash. Todo vence a los 30 días aunque nadie lo borre: un enlace olvidado no
 * queda para siempre.
 *
 * Es JavaScript con tipos en comentarios para que lo usen tal cual el Worker
 * de Cloudflare y el servidor local de las pruebas.
 *
 * @typedef {{ get(k: string): Promise<string | null>; put(k: string, v: string, o?: { expirationTtl?: number }): Promise<void>; delete(k: string): Promise<void> }} Almacen
 */

export const VENCE_EN_SEGUNDOS = 30 * 24 * 60 * 60;
export const TAMANO_MAXIMO = 200_000;
const RE_ID = /^[A-Za-z0-9_-]{22}$/;
const RE_CIFRADO = /^[A-Za-z0-9_-]+$/;

/** @param {number} n */
function aleatorio(n) {
  const b = crypto.getRandomValues(new Uint8Array(n));
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** @param {string} texto */
async function hash(texto) {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto)));
  return [...d].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** Comparación en tiempo constante, para no filtrar el hash de a un carácter. */
function iguales(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** @param {unknown} cuerpo @param {number} estado */
function json(cuerpo, estado = 200) {
  return new Response(cuerpo === null ? null : JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
  });
}

/** @param {Request} req */
async function leerCifrado(req) {
  const largo = Number(req.headers.get('content-length') ?? '0');
  if (largo > TAMANO_MAXIMO + 100) return null;
  const texto = await req.text();
  if (texto.length > TAMANO_MAXIMO + 100) return null;
  try {
    const j = JSON.parse(texto);
    const c = j && typeof j.cifrado === 'string' ? j.cifrado : null;
    return c && c.length <= TAMANO_MAXIMO && RE_CIFRADO.test(c) ? c : null;
  } catch {
    return null;
  }
}

/** @param {Request} req @param {Almacen} almacen @param {string} id */
async function autorizado(req, almacen, id) {
  const guardado = await almacen.get(id);
  if (!guardado) return { registro: null, ok: false };
  const registro = JSON.parse(guardado);
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  return { registro, ok: token !== '' && iguales(await hash(token), registro.tokenHash) };
}

/**
 * @param {Request} req
 * @param {Almacen | undefined} almacen
 * @returns {Promise<Response>}
 */
export async function manejar(req, almacen) {
  const url = new URL(req.url);
  const partes = url.pathname.replace(/\/+$/, '').split('/').slice(3);
  if (!url.pathname.startsWith('/api/compartidos')) return json({ error: 'no-existe' }, 404);
  if (!almacen) return json({ error: 'sin-configurar' }, 503);

  if (partes.length === 1 && partes[0] === 'salud' && req.method === 'GET') {
    return json({ servicio: 'salchi-compartir' });
  }

  if (partes.length === 0 && req.method === 'POST') {
    const cifrado = await leerCifrado(req);
    if (!cifrado) return json({ error: 'cuerpo-invalido' }, 400);
    const id = aleatorio(16);
    const token = aleatorio(32);
    await almacen.put(id, JSON.stringify({ cifrado, tokenHash: await hash(token) }), { expirationTtl: VENCE_EN_SEGUNDOS });
    return json({ id, token }, 201);
  }

  const id = partes[0] ?? '';
  if (partes.length !== 1 || !RE_ID.test(id)) return json({ error: 'no-existe' }, 404);

  if (req.method === 'GET') {
    const guardado = await almacen.get(id);
    if (!guardado) return json({ error: 'no-existe' }, 404);
    return json({ cifrado: JSON.parse(guardado).cifrado });
  }

  if (req.method === 'PUT' || req.method === 'DELETE') {
    const { registro, ok } = await autorizado(req, almacen, id);
    if (!registro) return json({ error: 'no-existe' }, 404);
    if (!ok) return json({ error: 'no-autorizado' }, 403);
    if (req.method === 'DELETE') {
      await almacen.delete(id);
      return json(null, 204);
    }
    const cifrado = await leerCifrado(req);
    if (!cifrado) return json({ error: 'cuerpo-invalido' }, 400);
    await almacen.put(id, JSON.stringify({ ...registro, cifrado }), { expirationTtl: VENCE_EN_SEGUNDOS });
    return json(null, 204);
  }

  return json({ error: 'metodo' }, 405);
}
