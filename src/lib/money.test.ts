import { describe, expect, it } from 'vitest';
import { centsToInput, formatMoney, parseMoney } from './money';

describe('parseMoney', () => {
  it('interpreta enteros simples', () => {
    expect(parseMoney('1500')).toBe(150000);
    expect(parseMoney('0')).toBe(0);
  });

  it('interpreta decimales con punto y con coma', () => {
    expect(parseMoney('1500.50')).toBe(150050);
    expect(parseMoney('1500,50')).toBe(150050);
    expect(parseMoney('0,05')).toBe(5);
  });

  it('distingue separador de miles del decimal según el formato', () => {
    expect(parseMoney('1.500,50')).toBe(150050); // es-AR
    expect(parseMoney('1,500.50')).toBe(150050); // en-US
    expect(parseMoney('1.500')).toBe(150000); // miles, no "un peso con medio"
    expect(parseMoney('1,50')).toBe(150); // decimal
  });

  it('ignora símbolos y espacios', () => {
    expect(parseMoney('$ 1.200')).toBe(120000);
    expect(parseMoney('  350  ')).toBe(35000);
  });

  it('con tres digitos a la derecha el separador es de miles, no decimal', () => {
    // "10.999" en es-AR son diez mil novecientos noventa y nueve, no 10 con 999.
    expect(parseMoney('10.999')).toBe(1099900);
    expect(parseMoney('10,999')).toBe(1099900);
  });

  it('trunca a dos decimales cuando hay mas precision de la que se puede guardar', () => {
    expect(parseMoney('1.500,999')).toBe(150099);
    expect(parseMoney('10.5')).toBe(1050);
  });

  it('devuelve null para entradas inválidas', () => {
    expect(parseMoney('')).toBeNull();
    expect(parseMoney('   ')).toBeNull();
    expect(parseMoney('abc')).toBeNull();
    expect(parseMoney('$')).toBeNull();
  });

  it('soporta negativos', () => {
    expect(parseMoney('-500')).toBe(-50000);
  });
});

describe('formatMoney', () => {
  it('agrupa los miles con punto', () => {
    expect(formatMoney(150050)).toBe('$ 1.500,50');
    expect(formatMoney(123456789)).toBe('$ 1.234.567,89');
  });

  it('omite los centavos cuando son cero', () => {
    expect(formatMoney(150000)).toBe('$ 1.500');
    expect(formatMoney(0)).toBe('$ 0');
    expect(formatMoney(3500000)).toBe('$ 35.000');
  });

  it('muestra los centavos cuando existen', () => {
    expect(formatMoney(5)).toBe('$ 0,05');
    expect(formatMoney(150010)).toBe('$ 1.500,10');
  });

  it('muestra negativos con el signo delante', () => {
    expect(formatMoney(-150050)).toBe('-$ 1.500,50');
    expect(formatMoney(-150000)).toBe('-$ 1.500');
  });

  it('respeta la moneda configurada', () => {
    expect(formatMoney(100000, 'US$')).toBe('US$ 1.000');
  });
});

describe('ida y vuelta', () => {
  it('centsToInput y parseMoney son inversas', () => {
    for (const cents of [0, 5, 150, 150050, 999999]) {
      const text = centsToInput(cents);
      expect(parseMoney(text) ?? 0).toBe(cents);
    }
  });

  it('sumar montos en centavos no acumula error de redondeo', () => {
    // 0.1 + 0.2 !== 0.3 en punto flotante; en centavos sí cierra.
    const total = (parseMoney('0,10') ?? 0) + (parseMoney('0,20') ?? 0);
    expect(total).toBe(parseMoney('0,30'));
  });
});
