import { whatsappSchemeUrl, whatsappWebUrl } from '../domain/whatsapp';

describe('links de WhatsApp', () => {
  it('usa los dígitos sin el + y escapa el texto', () => {
    expect(whatsappSchemeUrl('+5491123456789', 'Hola, ¿cómo va?')).toBe(
      'whatsapp://send?phone=5491123456789&text=Hola%2C%20%C2%BFc%C3%B3mo%20va%3F',
    );
  });

  it('arma el link web equivalente para el fallback', () => {
    expect(whatsappWebUrl('+5491123456789', 'hola')).toBe(
      'https://wa.me/5491123456789?text=hola',
    );
  });

  it('escapa saltos de línea', () => {
    expect(whatsappWebUrl('+5491123456789', 'uno\ndos')).toContain('uno%0Ados');
  });
});
