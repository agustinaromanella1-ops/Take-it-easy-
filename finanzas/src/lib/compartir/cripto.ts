/**
 * Cifrado de lo que se comparte, en el teléfono, antes de mandarlo.
 *
 * AES-GCM de 256 bits con la criptografía del navegador. La clave nunca va al
 * servidor: viaja en el enlace, después del "#", que el navegador no manda en
 * ningún pedido. El servidor guarda un bloque que no puede leer; si alguien
 * lo modificara, descifrar falla (GCM lo detecta) en vez de mostrar datos
 * cambiados.
 */

function aBase64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function deBase64url(texto: string): Uint8Array<ArrayBuffer> {
  const b64 = texto.replace(/-/g, '+').replace(/_/g, '/');
  const s = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

export function aleatorio(bytes: number): string {
  return aBase64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export function nuevaClave(): string {
  return aleatorio(32);
}

async function importar(clave: string): Promise<CryptoKey> {
  const bytes = deBase64url(clave);
  if (bytes.length !== 32) throw new Error('Clave inválida');
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function cifrar(valor: unknown, clave: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const datos = new TextEncoder().encode(JSON.stringify(valor));
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await importar(clave), datos));
  const todo = new Uint8Array(iv.length + cifrado.length);
  todo.set(iv);
  todo.set(cifrado, iv.length);
  return aBase64url(todo);
}

export async function descifrar(texto: string, clave: string): Promise<unknown> {
  const todo = deBase64url(texto);
  const iv = todo.slice(0, 12);
  const datos = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, await importar(clave), todo.slice(12));
  return JSON.parse(new TextDecoder().decode(datos));
}
