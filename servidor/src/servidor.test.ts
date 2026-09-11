import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';

import type { Resultado } from './consulta.js';
import type { Entrada } from './registro.js';
import { crearServidor, type Opciones } from './servidor.js';

const RESPUESTA: Resultado = { rechazado: false, tokensEntrada: 10, tokensSalida: 20 };

let cerrar: (() => void) | null = null;
afterEach(() => {
  cerrar?.();
  cerrar = null;
});

interface Montado {
  url: string;
  registro: Entrada[];
}

function montar(opciones: Partial<Opciones> = {}): Promise<Montado> {
  const registro: Entrada[] = [];
  const servidor = crearServidor({
    responder: async (_texto, alTexto) => {
      alTexto('Hola');
      alTexto(' de vuelta.');
      return RESPUESTA;
    },
    anotarEn: (entrada) => registro.push(entrada),
    ...opciones,
  });

  return new Promise((resolver) => {
    servidor.listen(0, () => {
      cerrar = () => servidor.close();
      const { port } = servidor.address() as AddressInfo;
      resolver({ url: `http://127.0.0.1:${port}`, registro });
    });
  });
}

async function consultar(url: string, cuerpo: unknown, instalacion = 'instalacion-de-prueba') {
  const res = await fetch(`${url}/consulta`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-instalacion': instalacion },
    body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo),
  });
  const texto = await res.text();
  const eventos = texto
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Record<string, unknown>);
  return { res, eventos };
}

describe('el camino feliz', () => {
  it('devuelve el texto de a trozos y cierra con un fin', async () => {
    const { url } = await montar();

    const { eventos } = await consultar(url, { texto: 'Necesito redactar una observación.' });

    expect(eventos).toEqual([
      { tipo: 'texto', texto: 'Hola' },
      { tipo: 'texto', texto: ' de vuelta.' },
      { tipo: 'fin' },
    ]);
  });

  it('registra metadata y ni una letra del texto', async () => {
    const { url, registro } = await montar();

    await consultar(url, { texto: 'Malena viene faltando mucho.' });

    expect(registro).toHaveLength(1);
    expect(registro[0]).toMatchObject({ estado: 200, tokensEntrada: 10, tokensSalida: 20 });
    expect(JSON.stringify(registro)).not.toContain('Malena');
    expect(JSON.stringify(registro)).not.toContain('faltando');
  });
});

describe('pedidos que no se atienden', () => {
  it('sin token de instalación no se atiende', async () => {
    const { url } = await montar();

    const { eventos } = await consultar(url, { texto: 'Hola' }, '');

    expect(eventos[0]).toMatchObject({ tipo: 'error', motivo: 'pedido' });
  });

  it('un texto vacío no se atiende', async () => {
    const { url } = await montar();

    expect((await consultar(url, { texto: '   ' })).eventos[0]).toMatchObject({ motivo: 'pedido' });
  });

  it('algo que no es JSON no se atiende', async () => {
    const { url } = await montar();

    expect((await consultar(url, 'esto no es json')).eventos[0]).toMatchObject({
      motivo: 'pedido',
    });
  });

  it('sin clave configurada lo dice, en vez de fallar raro', async () => {
    const { url, registro } = await montar({ responder: null });

    const { eventos } = await consultar(url, { texto: 'Hola' });

    expect(eventos[0]).toMatchObject({ tipo: 'error', motivo: 'sin-clave' });
    expect(registro[0]?.estado).toBe(503);
  });
});

describe('el límite de uso', () => {
  it('corta cuando una instalación consulta de más', async () => {
    const { url } = await montar({ limite: { porVentana: 2, ventanaMs: 60_000 } });

    await consultar(url, { texto: 'una' });
    await consultar(url, { texto: 'dos' });
    const { eventos } = await consultar(url, { texto: 'tres' });

    expect(eventos[0]).toMatchObject({ tipo: 'error', motivo: 'limite' });
  });

  it('el límite es por instalación, no del servidor entero', async () => {
    const { url } = await montar({ limite: { porVentana: 1, ventanaMs: 60_000 } });

    await consultar(url, { texto: 'una' }, 'instalacion-uno');
    const { eventos } = await consultar(url, { texto: 'otra' }, 'instalacion-dos');

    expect(eventos.at(-1)).toEqual({ tipo: 'fin' });
  });
});

describe('cuando el modelo rechaza o algo falla', () => {
  it('un rechazo llega como error y no como una respuesta vacía', async () => {
    const { url, registro } = await montar({
      responder: async () => ({ ...RESPUESTA, rechazado: true }),
    });

    const { eventos } = await consultar(url, { texto: 'Hola' });

    expect(eventos.at(-1)).toMatchObject({ tipo: 'error', motivo: 'rechazo' });
    expect(registro[0]).toMatchObject({ motivo: 'rechazo', tokensEntrada: 10 });
  });

  it('un error del proveedor no le llega a la docente con el detalle adentro', async () => {
    const { url } = await montar({
      responder: async () => {
        throw new Error('la consulta de la docente decía Malena');
      },
    });

    const { eventos } = await consultar(url, { texto: 'Hola' });

    expect(eventos.at(-1)).toMatchObject({ tipo: 'error', motivo: 'falla' });
    expect(JSON.stringify(eventos)).not.toContain('Malena');
  });

  it('si falla a mitad de camino, lo que ya se escribió llega igual', async () => {
    const { url } = await montar({
      responder: async (_texto, alTexto) => {
        alTexto('Empecé a contestar');
        throw new Error('se cortó');
      },
    });

    const { eventos } = await consultar(url, { texto: 'Hola' });

    expect(eventos[0]).toEqual({ tipo: 'texto', texto: 'Empecé a contestar' });
    expect(eventos.at(-1)).toMatchObject({ motivo: 'falla' });
  });
});

describe('salud', () => {
  it('dice si está configurado, sin exigir nada', async () => {
    const { url } = await montar({ responder: null });

    expect(await (await fetch(`${url}/salud`)).json()).toEqual({ ok: true, configurado: false });
  });
});
