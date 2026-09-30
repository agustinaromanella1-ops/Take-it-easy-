import type { Permisos } from './vista';

/**
 * Hablar con el servicio para compartir. Es del mismo origen que la app
 * (`/api/compartidos`), así que la política de contenido sigue prohibiendo
 * cualquier otro destino. Lo único que viaja es el bloque cifrado.
 */

const BASE = '/api/compartidos';

export type Estado = 'disponible' | 'sin-configurar' | 'sin-conexion';

export async function estadoDelServicio(): Promise<Estado> {
  try {
    const r = await fetch(`${BASE}/salud`, { cache: 'no-store' });
    if (!r.ok) return 'sin-configurar';
    const j = (await r.json().catch(() => null)) as { servicio?: string } | null;
    return j?.servicio === 'salchi-compartir' ? 'disponible' : 'sin-configurar';
  } catch {
    return navigator.onLine === false ? 'sin-conexion' : 'sin-configurar';
  }
}

async function pedir(url: string, init: RequestInit): Promise<Response> {
  const r = await fetch(url, { ...init, cache: 'no-store', headers: { 'content-type': 'application/json', ...(init.headers ?? {}) } });
  if (!r.ok && r.status !== 404) throw new Error(`El servicio respondió ${r.status}.`);
  return r;
}

export async function crear(cifrado: string): Promise<{ id: string; token: string }> {
  const r = await pedir(BASE, { method: 'POST', body: JSON.stringify({ cifrado }) });
  const j = (await r.json()) as { id: string; token: string };
  return { id: j.id, token: j.token };
}

export async function actualizar(id: string, token: string, cifrado: string): Promise<boolean> {
  const r = await pedir(`${BASE}/${id}`, { method: 'PUT', body: JSON.stringify({ cifrado }), headers: { authorization: `Bearer ${token}` } });
  return r.ok;
}

export async function revocar(id: string, token: string): Promise<void> {
  await pedir(`${BASE}/${id}`, { method: 'DELETE', headers: { authorization: `Bearer ${token}` } });
}

/** `null` si ya no existe (se revocó o venció). */
export async function obtener(id: string): Promise<string | null> {
  const r = await fetch(`${BASE}/${encodeURIComponent(id)}`, { cache: 'no-store' });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`El servicio respondió ${r.status}.`);
  const j = (await r.json()) as { cifrado: string };
  return j.cifrado;
}

/**
 * Lo compartido, visto desde el teléfono que comparte. Vive en el
 * dispositivo y NO en los datos ni en la copia: el token para revocar es un
 * secreto, y la clave también.
 */
export interface Compartido {
  id: string;
  token: string;
  clave: string;
  persona: string;
  permisos: Permisos;
  creadoEn: string;
  actualizadoEn: string;
}

const CLAVE = 'salchi:compartidos';

export function leerCompartidos(): Compartido[] {
  try {
    const x: unknown = JSON.parse(localStorage.getItem(CLAVE) ?? '[]');
    return Array.isArray(x) ? (x as Compartido[]).filter((c) => typeof c?.id === 'string' && typeof c?.token === 'string') : [];
  } catch {
    return [];
  }
}

export function guardarCompartidos(lista: Compartido[]): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(lista));
  } catch {
    /* Sin almacenamiento no se puede recordar el enlace para revocarlo: la pantalla lo avisa. */
  }
}

export function enlace(c: Pick<Compartido, 'id' | 'clave'>, origen: string): string {
  return `${origen}/ver#${c.id}.${c.clave}`;
}

