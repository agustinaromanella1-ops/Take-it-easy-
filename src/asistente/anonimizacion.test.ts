import { describe, expect, it } from 'vitest';

import {
  crearSesionDeAnonimizacion,
  sinDatosDeContacto,
  tieneDatosDeContacto,
  type Contexto,
} from './anonimizacion';

const malena = { id: 'a1', nombre: 'Malena', apellido: 'Acuña' };
const ignacio = { id: 'a2', nombre: 'Ignacio', apellido: 'Barreto' };
const sol = { id: 'a3', nombre: 'Sol', apellido: 'de la Fuente' };

function sesion(extra: Partial<Contexto> = {}) {
  return crearSesionDeAnonimizacion({
    alumnos: [malena, ignacio, sol],
    docente: 'Agustina Romanella',
    escuelas: ['Escuela N.º 12'],
    materias: ['Historia', 'Lengua'],
    ...extra,
  });
}

describe('sustitución de nombres conocidos', () => {
  it('reemplaza el nombre por un alias neutro', () => {
    const { texto } = sesion().anonimizar('Malena no entregó el trabajo.');

    expect(texto).toBe('Estudiante A no entregó el trabajo.');
  });

  it('el mismo alumno mantiene el mismo alias en todo el texto', () => {
    const { texto } = sesion().anonimizar('Malena faltó. Avisar a la familia de Malena.');

    expect(texto).toBe('Estudiante A faltó. Avisar a la familia de Estudiante A.');
  });

  it('alumnos distintos reciben alias distintos', () => {
    const { texto } = sesion().anonimizar('Malena e Ignacio hicieron el trabajo juntos.');

    expect(texto).toBe('Estudiante A e Estudiante B hicieron el trabajo juntos.');
  });

  it('nombre y apellido juntos son una persona, no dos', () => {
    const { texto } = sesion().anonimizar('Hablé con Malena Acuña ayer.');

    expect(texto).toBe('Hablé con Estudiante A ayer.');
  });

  it('reconoce el apellido escrito sin acento', () => {
    const { texto } = sesion().anonimizar('Acuna llegó tarde.');

    expect(texto).toBe('Estudiante A llegó tarde.');
  });

  it('reconoce el nombre en mayúsculas sostenidas', () => {
    const { texto } = sesion().anonimizar('BARRETO no vino.');

    expect(texto).toBe('Estudiante A no vino.');
  });

  it('reconoce el nombre pegado a un signo de puntuación', () => {
    const { texto } = sesion().anonimizar('¿Malena, entregaste el trabajo?');

    expect(texto).toBe('¿Estudiante A, entregaste el trabajo?');
  });

  it('sustituye el apellido compuesto entero', () => {
    const { texto } = sesion().anonimizar('Sol de la Fuente expuso muy bien.');

    expect(texto).not.toContain('Fuente');
    expect(texto).toContain('Estudiante A');
  });

  it('una partícula suelta no dispara nada', () => {
    const { texto } = sesion().anonimizar('Recordar la entrega de la semana que viene.');

    expect(texto).toBe('Recordar la entrega de la semana que viene.');
  });

  it('el nombre de la docente se reemplaza por su rol', () => {
    const { texto } = sesion().anonimizar('Agustina va a corregir el viernes.');

    expect(texto).toBe('la docente va a corregir el viernes.');
  });

  it('una escuela con número se reemplaza entera, que por palabras no se reemplazaba', () => {
    const { texto } = sesion().anonimizar('Doy clases en la Escuela N.º 12 desde marzo.');

    expect(texto).toBe('Doy clases en la escuela desde marzo.');
  });

  it('no duplica el artículo que ya estaba escrito', () => {
    const { texto } = sesion().anonimizar('La Escuela N.º 12 queda cerca.');

    expect(texto).not.toContain('la la');
    expect(texto).toBe('la escuela queda cerca.');
  });

  it('la encuentra aunque el número se escriba de otra forma', () => {
    for (const escrita of ['Escuela Nº 12', 'Escuela N 12', 'Escuela 12']) {
      expect(sesion().anonimizar(`Vengo de la ${escrita}.`).texto).toBe(
        'Vengo de la escuela.',
      );
    }
  });

  it('un número suelto no es la escuela', () => {
    const { texto } = sesion().anonimizar('Tengo 12 alumnos en el curso.');

    expect(texto).toBe('Tengo 12 alumnos en el curso.');
  });

  it('nombrar la escuela antes que a un alumno no le corre la letra', () => {
    const { texto } = sesion().anonimizar('En la Escuela N.º 12, Malena faltó.');

    expect(texto).toBe('En la escuela, Estudiante A faltó.');
  });

  it('la escuela vuelve a su nombre en la respuesta', () => {
    const s = sesion();
    s.anonimizar('Doy clases en la Escuela N.º 12.');

    expect(s.rePersonalizar('Convendría hablarlo en la escuela.')).toBe(
      'Convendría hablarlo en la Escuela N.º 12.',
    );
  });

  it('una escuela con nombre propio se reemplaza entera, con artículo y todo', () => {
    const s = () => sesion({ escuelas: ['Colegio San Martín'] });

    expect(s().anonimizar('Estoy en el Colegio San Martín.').texto).toBe('Estoy en la escuela.');
    expect(s().anonimizar('Vengo del Colegio San Martín.').texto).toBe('Vengo de la escuela.');
  });

  it('una mención parcial se lleva la partícula que va pegada al nombre', () => {
    const { texto } = sesion({ escuelas: ['Colegio San Martín'] }).anonimizar('Estoy en San Martín.');

    expect(texto).toBe('Estoy en la escuela.');
  });

  it('la partícula se va sólo cuando es parte del nombre de esa escuela', () => {
    const s = () => sesion({ escuelas: ['Instituto Los Andes'] });

    expect(s().anonimizar('Estoy en Los Andes.').texto).toBe('Estoy en la escuela.');
    // El mismo "los", suelto, no tiene nada que ver con la escuela.
    expect(s().anonimizar('Los chicos entregaron.').texto).toBe('Los chicos entregaron.');
  });

  it('no se come la preposición que une', () => {
    // El "de" es parte del nombre y aun así no se absorbe: sin frenar ahí,
    // "vengo de la Sagrada Familia" quedaría como "vengo la escuela".
    const { texto } = sesion({ escuelas: ['Escuela de la Sagrada Familia'] }).anonimizar(
      'Vengo de la Sagrada Familia.',
    );

    expect(texto).toBe('Vengo de la escuela.');
  });

  it('el nombre de la escuela se reemplaza por su rol', () => {
    const { texto } = sesion({ escuelas: ['Belgrano'] }).anonimizar('Vamos a Belgrano el lunes.');

    expect(texto).toBe('Vamos a la escuela el lunes.');
  });
});

describe('errar por exceso tiene un costo, y es el costo elegido', () => {
  it('un nombre que también es palabra común se sustituye igual', () => {
    // Hay una alumna que se llama Sol. "Hoy salió el sol" queda raro, y está
    // bien que quede raro: lo contrario es que un día se filtre el nombre.
    const { texto } = sesion().anonimizar('Trabajamos afuera porque salió el sol.');

    expect(texto).not.toContain('sol.');
    expect(texto).toContain('Estudiante');
  });
});

describe('dos alumnos con el mismo apellido', () => {
  const dosAcunas = {
    alumnos: [malena, { id: 'a9', nombre: 'Tomás', apellido: 'Acuña' }],
  };

  it('sustituye igual aunque no se sepa cuál es', () => {
    const { texto } = crearSesionDeAnonimizacion(dosAcunas).anonimizar('Acuña faltó.');

    expect(texto).not.toContain('Acuña');
    expect(texto).toContain('Estudiante');
  });

  it('con el nombre adelante sí distingue a cada uno', () => {
    const s = crearSesionDeAnonimizacion(dosAcunas);
    const { texto } = s.anonimizar('Malena Acuña y Tomás Acuña son hermanos.');

    const alias = texto.match(/Estudiante \w/g) ?? [];
    expect(new Set(alias).size).toBe(2);
    expect(texto).not.toContain('Acuña');
  });
});

describe('datos que no se guardan ni se envían', () => {
  it('no se lleva puesta la puntuación que sigue al dato', () => {
    const { texto } = crearSesionDeAnonimizacion({ alumnos: [] }).anonimizar(
      'Escribile a ana@correo.com, y si no mirá www.escuela.edu.ar.',
    );

    expect(texto).toBe('Escribile a [un correo], y si no mirá [un enlace].');
  });

  it('quita correos, teléfonos y enlaces', () => {
    const { texto, datosQuitados } = sesion().anonimizar(
      'Escribir a familia@ejemplo.com o llamar al 11 5555 4444, y ver www.escuela.edu.ar',
    );

    expect(texto).not.toContain('familia@ejemplo.com');
    expect(texto).not.toContain('5555');
    expect(texto).not.toContain('www.escuela.edu.ar');
    expect(datosQuitados).toHaveLength(3);
  });

  it('quita un documento', () => {
    const { texto } = sesion().anonimizar('El DNI es 45.678.901.');

    expect(texto).not.toContain('45.678.901');
    expect(texto).toContain('[un número]');
  });
});

describe('sospechas de nombres que la app no conoce', () => {
  it('marca un nombre propio desconocido', () => {
    const { sospechas } = sesion().anonimizar('La hermana Carolina vino a buscarlo.');

    expect(sospechas).toContain('Carolina');
  });

  it('no marca el arranque de la oración', () => {
    const { sospechas } = sesion().anonimizar('Trajo el certificado. Faltó el lunes.');

    expect(sospechas).toEqual([]);
  });

  it('no marca meses, días ni palabras de escuela', () => {
    const { sospechas } = sesion().anonimizar(
      'El trabajo sobre la Revolución de Mayo se entrega el Martes en la Escuela.',
    );

    expect(sospechas).toEqual([]);
  });

  it('no marca las materias de la docente', () => {
    const { sospechas } = sesion().anonimizar('En Historia y en Lengua venimos bien.');

    expect(sospechas).toEqual([]);
  });

  it('no marca los alias que acaba de poner', () => {
    const { sospechas } = sesion().anonimizar('Malena y Ignacio trabajaron juntos.');

    expect(sospechas).toEqual([]);
  });
});

describe('la respuesta vuelve con los nombres', () => {
  it('re-personaliza usando lo que estaba escrito', () => {
    const s = sesion();
    s.anonimizar('Malena no entregó el trabajo.');

    expect(s.rePersonalizar('Estudiante A podría entregarlo la semana que viene.')).toBe(
      'Malena podría entregarlo la semana que viene.',
    );
  });

  it('ida y vuelta deja el texto como estaba', () => {
    const s = sesion();
    const original = 'Malena e Ignacio hicieron el trabajo juntos.';

    expect(s.rePersonalizar(s.anonimizar(original).texto)).toBe(original);
  });

  it('un alias que el modelo inventó no se resuelve a nadie', () => {
    const s = sesion();
    s.anonimizar('Malena faltó.');

    // Nunca se envió un "Estudiante Z": no puede volver como un alumno real.
    expect(s.rePersonalizar('Estudiante Z faltó.')).toBe('Estudiante Z faltó.');
  });
});

describe('segundo escaneo defensivo', () => {
  it('encuentra el nombre que la docente volvió a escribir a mano', () => {
    const s = sesion();
    s.anonimizar('Estudiante A no entregó.');

    expect(s.nombresQueQuedaron('Malena no entregó el trabajo.')).toContain('Malena');
  });

  it('un texto ya limpio pasa', () => {
    expect(sesion().nombresQueQuedaron('Estudiante A no entregó el trabajo.')).toEqual([]);
  });

  it('el nombre de la docente no bloquea el envío', () => {
    // Molesto pero no es una fuga de datos de un alumno: se sustituye, no frena.
    expect(sesion().nombresQueQuedaron('Agustina corrige el viernes.')).toEqual([]);
  });
});

describe('el mapa de alias no sale de memoria', () => {
  it('serializar la sesión falla en vez de escribir nombres', () => {
    const s = sesion();
    s.anonimizar('Malena no entregó.');

    expect(() => JSON.stringify(s)).toThrow(/no se serializa/);
  });
});

describe('lo que no se guarda ni a medio escribir', () => {
  it('el borrador de la consulta no se lleva el correo a la base', () => {
    expect(sinDatosDeContacto('Escribile a ana@correo.com, dice que la llame.')).toBe(
      'Escribile a [un correo], dice que la llame.',
    );
  });

  it('tampoco un número largo, que puede ser un documento', () => {
    expect(sinDatosDeContacto('El teléfono es 11 2345 6789.')).toBe(
      'El teléfono es [un número].',
    );
  });

  it('el nombre del alumno sí se guarda: es un dato local, como una observación', () => {
    expect(sinDatosDeContacto('Malena viene faltando.')).toBe('Malena viene faltando.');
  });

  it('avisa cuando hay algo que se va a dejar afuera, para no alterar en silencio', () => {
    expect(tieneDatosDeContacto('Escribile a ana@correo.com')).toBe(true);
    expect(tieneDatosDeContacto('Malena viene faltando.')).toBe(false);
  });
});
