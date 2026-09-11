import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import Anthropic from '@anthropic-ai/sdk';

import type { Resultado } from './consulta.js';
import { crearLimitador, type Limite } from './limite.js';
import { leerPedido, LARGO_MAXIMO } from './pedido.js';
import { aLinea, MENSAJES, type Motivo } from './protocolo.js';
import { registrar, type Entrada } from './registro.js';

/**
 * Un proxy delgado y sin estado hacia la API de Anthropic. Existe por una sola
 * razón: no meter la clave de la API dentro del APK.
 *
 * No tiene base de datos. No guarda prompts ni respuestas. No tiene cuentas.
 * La app se identifica con un token de instalación anónimo generado en el
 * teléfono, que sirve para limitar el uso y para nada más.
 */

/** Contestar una consulta. Nulo cuando no hay clave configurada. */
export type Responder =
  | ((texto: string, alTexto: (trozo: string) => void) => Promise<Resultado>)
  | null;

export interface Opciones {
  responder: Responder;
  /** Tope por instalación. */
  limite?: Limite;
  /**
   * Tope de todo el proxy junto, por día. El de instalación no alcanza: la
   * dirección del proxy viaja dentro del APK, el APK es público, y el token de
   * instalación lo genera el teléfono, así que cualquiera puede inventarse uno
   * nuevo por consulta. Esto no impide el abuso; le pone techo a la factura.
   */
  topeDiario?: number;
  /** Para poder mirar en un test qué se registró, y qué no. */
  anotarEn?: (entrada: Entrada) => void;
}

export const TOPE_DIARIO = 300;

function cabeceras(res: ServerResponse) {
  // La app corre dentro de un WebView, así que su origen no es un dominio.
  // No hay nada que proteger por origen: el tope de gasto es el limitador.
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-headers', 'content-type, x-instalacion');
  res.setHeader('access-control-allow-methods', 'POST, OPTIONS');
}

async function leerCuerpo(req: IncomingMessage): Promise<string> {
  const trozos: Buffer[] = [];
  let largo = 0;
  for await (const trozo of req) {
    largo += (trozo as Buffer).length;
    // Cortar acá evita que un cuerpo enorme llene la memoria del proceso.
    if (largo > LARGO_MAXIMO * 4) throw new Error('cuerpo demasiado grande');
    trozos.push(trozo as Buffer);
  }
  return Buffer.concat(trozos).toString('utf8');
}

function cerrarCon(res: ServerResponse, motivo: Motivo) {
  res.write(aLinea({ tipo: 'error', motivo, mensaje: MENSAJES[motivo] }));
  res.end();
}

export function crearServidor({ responder, limite, topeDiario, anotarEn }: Opciones): Server {
  const limitador = crearLimitador(limite);
  const delDia = crearLimitador({
    porVentana: topeDiario ?? TOPE_DIARIO,
    ventanaMs: 24 * 60 * 60 * 1000,
  });
  // El mapa del limitador crece con cada instalación que consulta una vez y
  // nunca más; esto lo poda sin necesidad de una base de datos.
  const podar = setInterval(() => limitador.limpiar(), 10 * 60 * 1000);
  podar.unref();

  async function atender(req: IncomingMessage, res: ServerResponse) {
    cabeceras(res);

    if (req.method === 'OPTIONS') {
      res.writeHead(204).end();
      return;
    }
    if (req.method === 'GET' && req.url === '/salud') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, configurado: responder !== null }));
      return;
    }
    if (req.method !== 'POST' || req.url !== '/consulta') {
      res.writeHead(404).end();
      return;
    }

    const empezo = Date.now();
    const instalacion = req.headers['x-instalacion'];
    const pedido = leerPedido(
      await leerCuerpo(req).catch(() => ''),
      typeof instalacion === 'string' ? instalacion : undefined,
    );

    // Desde acá todo se contesta como línea de JSON, incluso los errores: la app
    // ya está leyendo un stream y no puede volver a mirar el código de estado.
    res.writeHead(200, {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-store',
      // Sin esto, un proxy intermedio junta los trozos y el texto aparece de
      // golpe al final, que es justo lo que el streaming viene a evitar.
      'x-accel-buffering': 'no',
    });

    const anotar = (estado: number, motivo?: Motivo, tokens?: [number, number]) => {
      const entrada: Entrada = {
        momento: Date.now(),
        estado,
        latenciaMs: Date.now() - empezo,
        instalacion: pedido.ok ? pedido.instalacion : 'desconocida',
        ...(tokens ? { tokensEntrada: tokens[0], tokensSalida: tokens[1] } : {}),
        ...(motivo ? { motivo } : {}),
      };
      if (anotarEn) anotarEn(entrada);
      else registrar(entrada);
    };

    if (!pedido.ok) {
      cerrarCon(res, 'pedido');
      anotar(400, 'pedido');
      return;
    }
    if (!responder) {
      cerrarCon(res, 'sin-clave');
      anotar(503, 'sin-clave');
      return;
    }

    if (!limitador.consultar(pedido.instalacion).permitido) {
      cerrarCon(res, 'limite');
      anotar(429, 'limite');
      return;
    }

    // El techo de la factura. Se cuenta después del tope por instalación para
    // que una sola instalación desbocada no se lleve puesto el día de todas.
    if (!delDia.consultar('todas').permitido) {
      cerrarCon(res, 'tope-del-dia');
      anotar(429, 'tope-del-dia');
      return;
    }

    try {
      const resultado = await responder(pedido.texto, (trozo) => {
        res.write(aLinea({ tipo: 'texto', texto: trozo }));
      });

      if (resultado.rechazado) {
        cerrarCon(res, 'rechazo');
        anotar(200, 'rechazo', [resultado.tokensEntrada, resultado.tokensSalida]);
        return;
      }

      res.write(aLinea({ tipo: 'fin' }));
      res.end();
      anotar(200, undefined, [resultado.tokensEntrada, resultado.tokensSalida]);
    } catch (e) {
      // El error del proveedor no se le muestra a la docente ni se registra
      // entero: puede traer el pedido adentro.
      cerrarCon(res, 'falla');
      anotar(e instanceof Anthropic.APIError ? (e.status ?? 502) : 500, 'falla');
    }
  }

  return createServer((req, res) => {
    void atender(req, res).catch(() => {
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
  });
}
