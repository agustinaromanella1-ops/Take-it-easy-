import { describe, expect, it } from 'vitest';

import {
  APROBADO_DESAPROBADO,
  CONCEPTUAL_COMUN,
  NUMERICA_1_10,
  cabeEnLaEscala,
  comoSeEscribe,
  comoSeLlamaLaEscala,
  esLaMismaEscala,
} from './escalas';

const etiquetas = (e: typeof CONCEPTUAL_COMUN) => (e.tipo === 'conceptual' ? e.etiquetas : []);

describe('aprobado o desaprobado', () => {
  it('tiene esas dos y nada más', () => {
    expect(etiquetas(APROBADO_DESAPROBADO).map((e) => e.texto)).toEqual([
      'Desaprobado',
      'Aprobado',
    ]);
  });

  it('va de peor a mejor, como la otra conceptual', () => {
    // El orden no es de adorno: es el que usa «Cómo quedó el curso» para
    // mostrar la distribución, y leerla al revés confunde.
    const [primera] = etiquetas(APROBADO_DESAPROBADO);
    expect(primera.texto).toBe('Desaprobado');
    expect(etiquetas(CONCEPTUAL_COMUN)[0].texto).toBe('No satisfactorio');
  });

  it('sus ids no chocan con los de la conceptual común', () => {
    // Una nota guardada apunta al id de su etiqueta. Si dos escalas
    // compartieran un id, cambiar la escala de una evaluación haría que una
    // nota vieja se leyera como otra cosa en vez de quedar sin leer.
    const comunes = new Set(etiquetas(CONCEPTUAL_COMUN).map((e) => e.id));
    for (const e of etiquetas(APROBADO_DESAPROBADO)) {
      expect(comunes.has(e.id)).toBe(false);
    }
  });

  it('acepta sus etiquetas y rechaza las de la otra', () => {
    expect(cabeEnLaEscala(APROBADO_DESAPROBADO, 'apr')).toBe(true);
    expect(cabeEnLaEscala(APROBADO_DESAPROBADO, 'mb')).toBe(false);
    expect(cabeEnLaEscala(APROBADO_DESAPROBADO, 7)).toBe(false);
  });

  it('se escribe con su texto', () => {
    expect(comoSeEscribe(APROBADO_DESAPROBADO, 'apr')).toBe('Aprobado');
    expect(comoSeEscribe(APROBADO_DESAPROBADO, 'des')).toBe('Desaprobado');
  });

  it('se presenta entera', () => {
    expect(comoSeLlamaLaEscala(APROBADO_DESAPROBADO)).toBe('Desaprobado · Aprobado');
  });
});

describe('comparar dos escalas', () => {
  it('las dos conceptuales no son la misma', () => {
    // Comparándolas por `tipo`, el formulario marcaría las dos como elegidas.
    expect(esLaMismaEscala(CONCEPTUAL_COMUN, APROBADO_DESAPROBADO)).toBe(false);
  });

  it('cada una es igual a sí misma', () => {
    expect(esLaMismaEscala(CONCEPTUAL_COMUN, CONCEPTUAL_COMUN)).toBe(true);
    expect(esLaMismaEscala(APROBADO_DESAPROBADO, APROBADO_DESAPROBADO)).toBe(true);
    expect(esLaMismaEscala(NUMERICA_1_10, NUMERICA_1_10)).toBe(true);
  });

  it('una copia también, que es como vuelven de la base', () => {
    // La evaluación guarda una copia de su escala, no una referencia.
    expect(esLaMismaEscala(JSON.parse(JSON.stringify(APROBADO_DESAPROBADO)), APROBADO_DESAPROBADO)).toBe(true);
  });

  it('una numérica nunca es una conceptual', () => {
    expect(esLaMismaEscala(NUMERICA_1_10, CONCEPTUAL_COMUN)).toBe(false);
    expect(esLaMismaEscala(CONCEPTUAL_COMUN, NUMERICA_1_10)).toBe(false);
  });

  it('dos numéricas de distinto rango no son la misma', () => {
    expect(
      esLaMismaEscala(NUMERICA_1_10, { tipo: 'numerica', min: 1, max: 5, decimales: 2 }),
    ).toBe(false);
  });
});
