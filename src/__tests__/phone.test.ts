import {
  displayName,
  normalizeArgentine,
  parsePhone,
  toWhatsAppDigits,
} from '../domain/phone';

describe('normalizeArgentine', () => {
  it('agrega el 9 a un número argentino que no lo trae', () => {
    expect(normalizeArgentine('+541123456789')).toEqual({
      e164: '+5491123456789',
      assumed: true,
    });
  });

  it('deja intacto uno que ya tiene el 9', () => {
    expect(normalizeArgentine('+5491123456789')).toEqual({
      e164: '+5491123456789',
      assumed: false,
    });
  });

  it('no toca números de otros países', () => {
    expect(normalizeArgentine('+59899123456')).toEqual({
      e164: '+59899123456',
      assumed: false,
    });
  });
});

describe('parsePhone', () => {
  it('interpreta un celular argentino escrito con 15', () => {
    const result = parsePhone('011 15 2345-6789', 'AR');
    expect(result.ok).toBe(true);
    expect(result.e164).toBe('+5491123456789');
  });

  it('interpreta un celular argentino escrito sin 15 ni 9', () => {
    const result = parsePhone('11 2345-6789', 'AR');
    expect(result.ok).toBe(true);
    expect(result.e164).toBe('+5491123456789');
    expect(result.assumedArgentineMobile).toBe(true);
  });

  it('acepta un número ya en formato internacional', () => {
    expect(parsePhone('+5491123456789').e164).toBe('+5491123456789');
  });

  it('rechaza basura', () => {
    expect(parsePhone('hola', 'AR').ok).toBe(false);
    expect(parsePhone('123', 'AR').ok).toBe(false);
  });

  it('respeta el país elegido', () => {
    expect(parsePhone('99 123 456', 'UY').e164).toBe('+59899123456');
  });
});

describe('toWhatsAppDigits', () => {
  it('saca el + y cualquier separador', () => {
    expect(toWhatsAppDigits('+54 9 11 2345 6789')).toBe('5491123456789');
  });
});

describe('displayName', () => {
  it('prefiere el nombre del contacto', () => {
    expect(displayName('Sofi', '+5491123456789')).toBe('Sofi');
  });

  it('cae al número formateado si no hay nombre', () => {
    expect(displayName(null, '+5491123456789')).toBe('+54 9 11 2345 6789');
    expect(displayName('   ', '+5491123456789')).toBe('+54 9 11 2345 6789');
  });
});
