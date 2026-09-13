import {
  extractVariables,
  missingVariables,
  renderTemplate,
} from '../domain/templates';

describe('extractVariables', () => {
  it('encuentra las variables en orden y sin repetir', () => {
    expect(extractVariables('Hola {nombre}, te espero el {día}. Chau {nombre}'))
      .toEqual(['nombre', 'día']);
  });

  it('acepta acentos y ñ', () => {
    expect(extractVariables('Feliz {año} {compañera}')).toEqual([
      'año',
      'compañera',
    ]);
  });

  it('devuelve vacío si no hay ninguna', () => {
    expect(extractVariables('Hola, ¿cómo va?')).toEqual([]);
  });
});

describe('renderTemplate', () => {
  it('reemplaza las que tienen valor', () => {
    expect(renderTemplate('Hola {nombre}', { nombre: 'Sofi' })).toBe('Hola Sofi');
  });

  it('deja visible la que quedó sin completar', () => {
    expect(renderTemplate('Hola {nombre}, el {día}', { nombre: 'Sofi' })).toBe(
      'Hola Sofi, el {día}',
    );
  });

  it('trata un valor en blanco como sin completar', () => {
    expect(renderTemplate('Hola {nombre}', { nombre: '   ' })).toBe(
      'Hola {nombre}',
    );
  });

  it('reemplaza todas las apariciones', () => {
    expect(renderTemplate('{a} y {a}', { a: 'x' })).toBe('x y x');
  });
});

describe('missingVariables', () => {
  it('lista solo las que faltan', () => {
    expect(
      missingVariables('Hola {nombre}, el {día}', { nombre: 'Sofi' }),
    ).toEqual(['día']);
  });

  it('no devuelve nada si está todo completo', () => {
    expect(missingVariables('Hola {nombre}', { nombre: 'Sofi' })).toEqual([]);
  });
});
