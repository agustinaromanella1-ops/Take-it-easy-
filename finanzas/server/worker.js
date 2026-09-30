import { manejar } from './compartir.js';

/**
 * El Worker de Cloudflare que sirve Salchi: la app estática y, en el mismo
 * origen, el servicio para compartir. Mismo origen a propósito: la política
 * de contenido de la app (`connect-src 'self'`) sigue sin permitir ningún
 * otro destino.
 *
 * Si el almacenamiento (KV `COMPARTIDOS`) no está configurado, el servicio
 * responde 503 "sin-configurar" y la app lo muestra como pendiente. Ver
 * `COMPARTIR.md`.
 */
export default {
  /** @param {Request} req @param {{ ASSETS: { fetch(r: Request): Promise<Response> }; COMPARTIDOS?: import('./compartir.js').Almacen }} env */
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/')) return manejar(req, env.COMPARTIDOS);
    return env.ASSETS.fetch(req);
  },
};
