import {
  CONSEJOS,
  quedanConsejos,
  siguienteConsejo,
} from '../domain/ayuda';

describe('los consejos', () => {
  it('no repiten id', () => {
    const ids = CONSEJOS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('todos tienen título y texto', () => {
    for (const c of CONSEJOS) {
      expect(c.titulo.trim()).not.toBe('');
      expect(c.texto.trim()).not.toBe('');
    }
  });
});

describe('siguienteConsejo', () => {
  it('devuelve el primero de esa pantalla si no se vio ninguno', () => {
    expect(siguienteConsejo('programados', [])?.id).toBe('empezar');
  });

  it('muestra de a uno: el siguiente recién cuando se descartó el anterior', () => {
    expect(siguienteConsejo('programados', ['empezar'])?.id).toBe('confirmar');
  });

  it('no devuelve nada cuando se vieron todos los de la pantalla', () => {
    expect(siguienteConsejo('programados', ['empezar', 'confirmar'])).toBeNull();
  });

  it('no mezcla pantallas', () => {
    // 'atajos' es de la pantalla de mensaje nuevo, no de programados.
    expect(siguienteConsejo('programados', ['empezar', 'confirmar', 'atajos'])).toBeNull();
    expect(siguienteConsejo('nuevo', [])?.id).toBe('atajos');
  });

  it('hay uno sobre plantillas, que es lo que cuesta encontrar', () => {
    const sobrePlantillas = CONSEJOS.filter((c) =>
      `${c.id} ${c.titulo} ${c.texto}`.toLowerCase().includes('plantilla'),
    );
    expect(sobrePlantillas.length).toBeGreaterThan(0);
  });
});

describe('quedanConsejos', () => {
  it('es cierto mientras falte alguno', () => {
    expect(quedanConsejos([])).toBe(true);
    expect(quedanConsejos(['empezar'])).toBe(true);
  });

  it('es falso cuando se vieron todos', () => {
    expect(quedanConsejos(CONSEJOS.map((c) => c.id))).toBe(false);
  });
});
