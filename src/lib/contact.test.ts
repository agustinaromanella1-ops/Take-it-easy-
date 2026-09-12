import { describe, expect, it } from 'vitest';
import { normalizePhone, whatsappLink } from './contact';

describe('normalizePhone', () => {
  it('saca espacios, guiones y paréntesis', () => {
    expect(normalizePhone('+54 9 11 5555-4444')).toBe('5491155554444');
    expect(normalizePhone('+54 (11) 5555 4444')).toBe('541155554444');
  });

  it('agrega el código de país a un número local', () => {
    expect(normalizePhone('11 5555-4444')).toBe('541155554444');
  });

  it('saca el 0 de larga distancia', () => {
    expect(normalizePhone('011 5555-4444')).toBe('541155554444');
  });

  it('saca el 15 de celular, que no va en formato internacional', () => {
    expect(normalizePhone('011 15 5555-4444')).toBe('541155554444');
  });

  it('no vuelve a agregar el país si ya está', () => {
    expect(normalizePhone('5491155554444')).toBe('5491155554444');
  });

  it('acepta el prefijo internacional en formato 00', () => {
    expect(normalizePhone('0054 11 5555 4444')).toBe('541155554444');
  });

  it('respeta un número de otro país escrito con +', () => {
    expect(normalizePhone('+1 415 555 2671')).toBe('14155552671');
  });

  it('admite otro código de país por defecto', () => {
    expect(normalizePhone('600 123 456', '34')).toBe('34600123456');
  });

  it('devuelve null cuando no hay número usable', () => {
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone('   ')).toBeNull();
    expect(normalizePhone('sin teléfono')).toBeNull();
    expect(normalizePhone('123')).toBeNull();
  });
});

describe('whatsappLink', () => {
  it('arma el enlace con el número normalizado', () => {
    expect(whatsappLink('011 5555-4444')).toBe('https://wa.me/541155554444');
  });

  it('agrega el mensaje codificado', () => {
    expect(whatsappLink('011 5555-4444', 'Hola María, ¿confirmás?')).toBe(
      'https://wa.me/541155554444?text=Hola%20Mar%C3%ADa%2C%20%C2%BFconfirm%C3%A1s%3F',
    );
  });

  it('omite el texto si el mensaje está vacío', () => {
    expect(whatsappLink('011 5555-4444', '   ')).toBe('https://wa.me/541155554444');
  });

  it('devuelve null con un teléfono inservible', () => {
    expect(whatsappLink('', 'hola')).toBeNull();
  });
});
