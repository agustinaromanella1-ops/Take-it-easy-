import { describe, expect, it } from 'vitest';

import { MARCADORES, crearSesionDeAnonimizacion } from './anonimizacion';
import { loResaltado, revisar, sacar, trozos } from './revision';

const contexto = {
  alumnos: [
    { id: '1', nombre: 'Malena', apellido: 'Acuña' },
    { id: '2', nombre: 'Ignacio', apellido: 'Barreto' },
  ],
  docente: 'Agustina Romanella',
  escuelas: ['Escuela N.º 12'],
  materias: ['Historia'],
};

const sesion = () => crearSesionDeAnonimizacion(contexto);

describe('lo que decide si se envía', () => {
  it('deja enviar un texto que ya pasó por el filtro', () => {
    const s = sesion();
    const { texto } = s.anonimizar('Malena no entregó el trabajo.');

    expect(revisar(s, texto, []).sePuedeEnviar).toBe(true);
  });

  it('no deja enviar si la docente reescribió un nombre a mano', () => {
    const s = sesion();
    s.anonimizar('Malena no entregó el trabajo.');

    // Permitida como sospecha a propósito: así lo único que puede frenar el
    // envío es el escaneo defensivo, que es lo que este test prueba.
    const r = revisar(s, 'Estudiante A no entregó, igual que Malena.', ['Malena']);

    expect(r.nombres).toEqual(['Malena']);
    expect(r.sePuedeEnviar).toBe(false);
  });

  it('frena un nombre escrito en minúscula, que ninguna sospecha marcaría', () => {
    const s = sesion();

    const r = revisar(s, 'el trabajo de malena quedó a medias', []);

    expect(r.sospechas).toEqual([]);
    expect(r.nombres).toEqual(['malena']);
    expect(r.sePuedeEnviar).toBe(false);
  });

  it('encuentra el nombre reescrito aunque cambie la capitalización o el acento', () => {
    const s = sesion();

    expect(revisar(s, 'hablé con acuna ayer', []).nombres).toEqual(['acuna']);
  });

  it('una palabra que parece un nombre y no se conoce frena el envío hasta decidir', () => {
    const s = sesion();

    const r = revisar(s, 'El hermano, Joaquín, vino a buscarla.', []);

    expect(r.sospechas).toEqual(['Joaquín']);
    expect(r.sePuedeEnviar).toBe(false);
  });

  it('decidir que no es un nombre la deja pasar', () => {
    const s = sesion();
    const texto = 'El hermano, Joaquín, vino a buscarla.';

    expect(revisar(s, texto, ['Joaquín']).sospechas).toEqual([]);
    expect(revisar(s, texto, ['Joaquín']).sePuedeEnviar).toBe(true);
  });

  it('una decisión no alcanza para otra palabra distinta', () => {
    const s = sesion();

    const r = revisar(s, 'Vinieron Joaquín y Renata.', ['Joaquín']);

    expect(r.sospechas).toEqual(['Renata']);
    expect(r.sePuedeEnviar).toBe(false);
  });

  it('un nombre conocido no se ofrece además como duda a decidir', () => {
    const s = sesion();

    const r = revisar(s, 'En realidad fue Malena la que faltó.', []);

    expect(r.nombres).toEqual(['Malena']);
    expect(r.sospechas).toEqual([]);
  });

  it('frena un correo escrito a mano en la revisión', () => {
    const s = sesion();

    const r = revisar(s, 'Escribile a ana@correo.com y contale.', []);

    expect(r.datos).toEqual(['ana@correo.com']);
    expect(r.sePuedeEnviar).toBe(false);
  });

  it('frena también un teléfono y un enlace', () => {
    const s = sesion();

    expect(revisar(s, 'Llamala al 11 2345 6789.', []).sePuedeEnviar).toBe(false);
    expect(revisar(s, 'Está en www.escuela.edu.ar', []).sePuedeEnviar).toBe(false);
  });

  it('con el dato reemplazado por su marcador, se puede enviar', () => {
    const s = sesion();

    expect(revisar(s, 'Escribile a [un correo] y contale.', []).sePuedeEnviar).toBe(true);
  });

  it('un texto vacío no se envía', () => {
    expect(revisar(sesion(), '   \n ', []).sePuedeEnviar).toBe(false);
  });

  it('el nombre conocido pesa más que la decisión: permitirlo no lo desbloquea', () => {
    const s = sesion();

    expect(revisar(s, 'Malena faltó.', ['Malena']).sePuedeEnviar).toBe(false);
  });
});

describe('sacar una palabra', () => {
  it('la reemplaza por el marcador', () => {
    expect(sacar('Vino Joaquín a buscarla.', 'Joaquín')).toBe(
      `Vino ${MARCADORES.nombre} a buscarla.`,
    );
  });

  it('saca todas las veces que aparece', () => {
    expect(sacar('Joaquín dijo que Joaquín venía.', 'Joaquín')).toBe(
      `${MARCADORES.nombre} dijo que ${MARCADORES.nombre} venía.`,
    );
  });

  it('no toca una palabra que la contiene', () => {
    expect(sacar('Ana y Anabela.', 'Ana')).toBe(`${MARCADORES.nombre} y Anabela.`);
  });

  it('funciona con una palabra que termina en acento, donde \\b falla', () => {
    expect(sacar('Vino José ayer.', 'José')).toBe(`Vino ${MARCADORES.nombre} ayer.`);
  });

  it('funciona con una palabra que empieza con acento', () => {
    expect(sacar('Vino Ángel ayer.', 'Ángel')).toBe(`Vino ${MARCADORES.nombre} ayer.`);
  });

  it('la saca aunque esté pegada a un signo de puntuación', () => {
    expect(sacar('¿Vino Joaquín?', 'Joaquín')).toBe(`¿Vino ${MARCADORES.nombre}?`);
  });

  it('después de sacarla, el texto se puede enviar', () => {
    const s = sesion();
    const limpio = sacar('El hermano, Joaquín, vino.', 'Joaquín');

    expect(revisar(s, limpio, []).sePuedeEnviar).toBe(true);
  });
});

describe('resaltar lo reemplazado', () => {
  it('separa lo reemplazado del resto', () => {
    expect(trozos('Hola Estudiante A y chau', ['Estudiante A'])).toEqual([
      { texto: 'Hola ', resaltado: false },
      { texto: 'Estudiante A', resaltado: true },
      { texto: ' y chau', resaltado: false },
    ]);
  });

  it('resalta al principio y al final sin dejar trozos vacíos', () => {
    expect(trozos('Estudiante A', ['Estudiante A'])).toEqual([
      { texto: 'Estudiante A', resaltado: true },
    ]);
  });

  it('sin nada que resaltar devuelve el texto entero', () => {
    expect(trozos('sin nombres acá', [])).toEqual([{ texto: 'sin nombres acá', resaltado: false }]);
  });

  it('resalta también los marcadores de los datos que no viajan', () => {
    const s = sesion();
    const { texto, sustituciones } = s.anonimizar('Malena, escribile a ana@correo.com');

    const partes = trozos(texto, loResaltado(sustituciones));

    expect(partes.filter((p) => p.resaltado).map((p) => p.texto)).toEqual([
      'Estudiante A',
      MARCADORES.correo,
    ]);
  });

  it('el texto se puede reconstruir entero: resaltar no pierde nada', () => {
    const s = sesion();
    const { texto, sustituciones } = s.anonimizar(
      'Malena y Ignacio faltaron. Escribile a ana@correo.com o al 11 2345 6789.',
    );

    expect(trozos(texto, loResaltado(sustituciones)).map((p) => p.texto).join('')).toBe(texto);
  });
});
