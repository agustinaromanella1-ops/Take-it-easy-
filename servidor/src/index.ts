import { responder } from './consulta.js';
import { crearServidor } from './servidor.js';
import Anthropic from '@anthropic-ai/sdk';

/**
 * Levantar el proxy. Sin clave configurada arranca igual y contesta que no
 * está configurado: así se puede desplegar y probar la salud antes de poner
 * la clave.
 */

const PUERTO = Number(process.env.PORT ?? 8787);
const clave = process.env.ANTHROPIC_API_KEY;
const cliente = clave ? new Anthropic({ apiKey: clave }) : null;

crearServidor({
  responder: cliente ? (texto, alTexto) => responder(cliente, texto, alTexto) : null,
}).listen(PUERTO, () => {
  console.log(`Escuchando en ${PUERTO}. Clave: ${cliente ? 'configurada' : 'sin configurar'}.`);
});
