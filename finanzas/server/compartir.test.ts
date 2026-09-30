import { manejar, TAMANO_MAXIMO } from './compartir.js';

function almacen() {
  const m = new Map<string, string>();
  return {
    m,
    async get(k: string) {
      return m.get(k) ?? null;
    },
    async put(k: string, v: string) {
      m.set(k, v);
    },
    async delete(k: string) {
      m.delete(k);
    },
  };
}

const B = 'https://salchi.test/api/compartidos';
const pedir = (a: ReturnType<typeof almacen> | undefined, metodo: string, ruta = '', cuerpo?: unknown, token?: string) =>
  manejar(
    new Request(B + ruta, {
      method: metodo,
      ...(cuerpo !== undefined ? { body: JSON.stringify(cuerpo) } : {}),
      headers: token ? { authorization: `Bearer ${token}` } : {},
    }),
    a,
  );

describe('servicio para compartir', () => {
  it('sin almacenamiento configurado, lo dice', async () => {
    const r = await pedir(undefined, 'GET', '/salud');
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ error: 'sin-configurar' });
  });

  it('crear, leer, actualizar con el token y revocar', async () => {
    const a = almacen();
    expect(await (await pedir(a, 'GET', '/salud')).json()).toEqual({ servicio: 'salchi-compartir' });
    const creado = await pedir(a, 'POST', '', { cifrado: 'abc_DEF-123' });
    expect(creado.status).toBe(201);
    const { id, token } = (await creado.json()) as { id: string; token: string };
    expect(id).toMatch(/^[A-Za-z0-9_-]{22}$/);

    expect(await (await pedir(a, 'GET', `/${id}`)).json()).toEqual({ cifrado: 'abc_DEF-123' });
    expect((await pedir(a, 'PUT', `/${id}`, { cifrado: 'nuevo' }, token)).status).toBe(204);
    expect(await (await pedir(a, 'GET', `/${id}`)).json()).toEqual({ cifrado: 'nuevo' });

    expect((await pedir(a, 'DELETE', `/${id}`, undefined, token)).status).toBe(204);
    expect((await pedir(a, 'GET', `/${id}`)).status).toBe(404);
  });

  it('sin el token no se puede cambiar ni borrar', async () => {
    const a = almacen();
    const { id } = (await (await pedir(a, 'POST', '', { cifrado: 'x' })).json()) as { id: string };
    expect((await pedir(a, 'PUT', `/${id}`, { cifrado: 'y' })).status).toBe(403);
    expect((await pedir(a, 'DELETE', `/${id}`, undefined, 'otro-token')).status).toBe(403);
    expect(await (await pedir(a, 'GET', `/${id}`)).json()).toEqual({ cifrado: 'x' });
  });

  it('no guarda el token, solo su hash', async () => {
    const a = almacen();
    const { id, token } = (await (await pedir(a, 'POST', '', { cifrado: 'x' })).json()) as { id: string; token: string };
    expect(a.m.get(id)).not.toContain(token);
  });

  it('rechaza cuerpos inválidos o demasiado grandes', async () => {
    const a = almacen();
    expect((await pedir(a, 'POST', '', { cifrado: 'con espacios y <script>' })).status).toBe(400);
    expect((await pedir(a, 'POST', '', { otro: 1 })).status).toBe(400);
    expect((await pedir(a, 'POST', '', { cifrado: 'a'.repeat(TAMANO_MAXIMO + 1) })).status).toBe(400);
    expect(a.m.size).toBe(0);
  });

  it('ids raros no llegan al almacenamiento', async () => {
    const a = almacen();
    expect((await pedir(a, 'GET', '/../../etc')).status).toBe(404);
    expect((await pedir(a, 'GET', '/corto')).status).toBe(404);
  });
});
