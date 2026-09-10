import { describe, expect, it } from 'vitest';

import { parsearLista } from './parseo';

describe('parseo de la lista pegada', () => {
  it('lee el formato con numeración y coma', () => {
    const filas = parsearLista(`1. ACUÑA, Malena
2. BARRETO, Ignacio`);

    expect(filas).toHaveLength(2);
    expect(filas[0]).toMatchObject({ apellido: 'Acuña', nombre: 'Malena', confianza: 'alta' });
    expect(filas[1]).toMatchObject({ apellido: 'Barreto', nombre: 'Ignacio', confianza: 'alta' });
  });

  it('con coma, un apellido o un nombre compuesto no es ambiguo', () => {
    const filas = parsearLista(`CABRERA NIETO, Delfina
ESQUIVEL, Camila del Valle`);

    expect(filas[0]).toMatchObject({
      apellido: 'Cabrera Nieto', nombre: 'Delfina', confianza: 'alta',
    });
    expect(filas[1]).toMatchObject({
      apellido: 'Esquivel', nombre: 'Camila del Valle', confianza: 'alta',
    });
  });

  it('usa las mayúsculas para saber cuál es el apellido', () => {
    const filas = parsearLista('DUARTE Joaquín');

    expect(filas[0]).toMatchObject({ apellido: 'Duarte', nombre: 'Joaquín', confianza: 'alta' });
  });

  it('separa por tabulaciones y por columnas de espacios', () => {
    const filas = parsearLista('Ferreyra\tBautista\nGauna    Renata');

    expect(filas[0]).toMatchObject({ apellido: 'Ferreyra', nombre: 'Bautista' });
    expect(filas[1]).toMatchObject({ apellido: 'Gauna', nombre: 'Renata' });
  });

  it('marca para revisar cuando no hay forma de saber cuál es el apellido', () => {
    const filas = parsearLista('Malena Acuña');

    expect(filas[0].confianza).toBe('revisar');
    expect(filas[0].motivo).toBeTruthy();
  });

  it('descarta el DNI y no lo deja en ningún campo', () => {
    const filas = parsearLista('1. ACUÑA, Malena    45.678.901');

    expect(filas[0]).toMatchObject({ apellido: 'Acuña', nombre: 'Malena' });
    expect(filas[0].descartado).toContain('45.678.901');
    expect(JSON.stringify(filas[0])).not.toContain('45678901');
  });

  it('descarta correos y teléfonos', () => {
    const filas = parsearLista(`BARRETO, Ignacio, familia@ejemplo.com
GAUNA, Renata  11 5555 4444`);

    expect(filas[0].descartado).toContain('familia@ejemplo.com');
    expect(filas[0].nombre).toBe('Ignacio');
    expect(filas[1].descartado.join(' ')).toContain('5555');
    expect(filas[1].nombre).toBe('Renata');
  });

  it('saltea encabezados de planilla', () => {
    const filas = parsearLista(`N° Apellido y Nombre
1. ACUÑA, Malena`);

    expect(filas).toHaveLength(1);
    expect(filas[0].apellido).toBe('Acuña');
  });

  it('ignora líneas vacías', () => {
    expect(parsearLista('\n\nACUÑA, Malena\n\n\n')).toHaveLength(1);
  });

  it('normaliza las mayúsculas sostenidas sin romper las partículas', () => {
    const filas = parsearLista('DE LA FUENTE, MARÍA SOL');

    expect(filas[0]).toMatchObject({ apellido: 'de la Fuente', nombre: 'María Sol' });
  });

  it('guarda la línea original para poder comparar', () => {
    const filas = parsearLista('1. ACUÑA, Malena');

    expect(filas[0].linea).toBe('1. ACUÑA, Malena');
  });
});
