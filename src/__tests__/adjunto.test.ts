import {
  LIMITE_BYTES,
  LIMITE_MEDIA_BYTES,
  avisoDeTamano,
  emojiDe,
  esMedia,
  formatearTamano,
  nombreEnDisco,
  rechazar,
  tipoLegible,
  type Adjunto,
} from '../domain/adjunto';
import { adjuntoDe, columnasDeAdjunto } from '../domain/types';

const foto = (bytes: number): Adjunto => ({
  archivo: 'abc-foto.jpg',
  nombre: 'foto.jpg',
  mime: 'image/jpeg',
  bytes,
});

describe('formatearTamano', () => {
  it('usa la unidad que se entiende de un vistazo', () => {
    expect(formatearTamano(512)).toBe('512 B');
    expect(formatearTamano(2048)).toBe('2 kB');
    expect(formatearTamano(3 * 1024 * 1024)).toBe('3 MB');
  });

  it('escribe el decimal con coma, como se escribe acá', () => {
    expect(formatearTamano(1.5 * 1024 * 1024)).toBe('1,5 MB');
  });

  it('a partir de diez megas el decimal no aporta nada', () => {
    expect(formatearTamano(12.4 * 1024 * 1024)).toBe('12 MB');
  });

  it('no inventa nada con una entrada rota', () => {
    expect(formatearTamano(Number.NaN)).toBe('');
    expect(formatearTamano(-1)).toBe('');
  });
});

describe('rechazar', () => {
  it('deja pasar lo que entra en el límite', () => {
    expect(rechazar(LIMITE_BYTES)).toBeNull();
    expect(rechazar(1)).toBeNull();
  });

  it('frena lo que no podemos guardar hasta la hora del mensaje', () => {
    expect(rechazar(LIMITE_BYTES + 1)).toBe('demasiado-grande');
  });

  it('un archivo de cero bytes no se pudo leer', () => {
    expect(rechazar(0)).toBe('vacio');
  });
});

describe('avisoDeTamano', () => {
  it('avisa cuando WhatsApp va a rebotar la foto', () => {
    expect(avisoDeTamano(foto(LIMITE_MEDIA_BYTES + 1))).toContain('16 MB');
  });

  it('concuerda el artículo con el tipo', () => {
    expect(avisoDeTamano(foto(LIMITE_MEDIA_BYTES + 1))).toContain('Es una foto');
    expect(
      avisoDeTamano({
        archivo: 'x.mp4',
        nombre: 'x.mp4',
        mime: 'video/mp4',
        bytes: LIMITE_MEDIA_BYTES + 1,
      }),
    ).toContain('Es un video');
  });

  it('no molesta con una foto que entra', () => {
    expect(avisoDeTamano(foto(LIMITE_MEDIA_BYTES))).toBeNull();
  });

  it('el límite de 16 MB es para media: un documento pesado pasa', () => {
    const pdf: Adjunto = {
      archivo: 'x-informe.pdf',
      nombre: 'informe.pdf',
      mime: 'application/pdf',
      bytes: 40 * 1024 * 1024,
    };
    expect(esMedia(pdf.mime)).toBe(false);
    expect(avisoDeTamano(pdf)).toBeNull();
  });
});

describe('tipoLegible y emojiDe', () => {
  it('nombra cada tipo como lo nombraría una persona', () => {
    expect(tipoLegible('image/png')).toBe('Foto');
    expect(tipoLegible('video/mp4')).toBe('Video');
    expect(tipoLegible('audio/ogg')).toBe('Audio');
    expect(tipoLegible('application/pdf')).toBe('PDF');
    expect(tipoLegible('application/vnd.ms-excel')).toBe('Documento');
  });

  it('siempre da un emoji, aunque el tipo sea desconocido', () => {
    expect(emojiDe('application/octet-stream')).toBe('📎');
    expect(emojiDe('image/heic')).toBe('🖼️');
  });
});

describe('nombreEnDisco', () => {
  it('saca lo que el sistema de archivos no acepta', () => {
    const nombre = nombreEnDisco('id1', 'carpeta/sub:archivo?.pdf');
    expect(nombre).toBe('id1-carpeta_sub_archivo_.pdf');
    expect(nombre).not.toMatch(/[/\\:*?"<>|]/);
  });

  it('el id adelante evita que dos IMG_0001.jpg se pisen', () => {
    expect(nombreEnDisco('a', 'IMG_0001.jpg')).not.toBe(
      nombreEnDisco('b', 'IMG_0001.jpg'),
    );
  });

  it('un nombre que empieza con punto no queda oculto', () => {
    expect(nombreEnDisco('id1', '.perfil')).toBe('id1-_perfil');
  });

  it('un nombre larguísimo se recorta y conserva la extensión', () => {
    const largo = `${'a'.repeat(300)}.pdf`;
    const nombre = nombreEnDisco('id1', largo);
    expect(nombre.length).toBeLessThanOrEqual(84);
    expect(nombre.endsWith('.pdf')).toBe(true);
  });

  it('un nombre vacío no deja el archivo sin nombre', () => {
    expect(nombreEnDisco('id1', '')).toBe('id1-archivo');
  });
});

describe('las columnas de la base y el objeto del dominio', () => {
  it('ida y vuelta sin perder nada', () => {
    const original = foto(1234);
    expect(adjuntoDe(columnasDeAdjunto(original))).toEqual(original);
  });

  it('sin adjunto son cuatro nulls, no undefined: SQLite no liga undefined', () => {
    expect(columnasDeAdjunto(null)).toEqual({
      attachmentFile: null,
      attachmentName: null,
      attachmentMime: null,
      attachmentBytes: null,
    });
  });

  it('una fila vieja sin las columnas no inventa un adjunto', () => {
    expect(
      adjuntoDe({
        attachmentFile: null,
        attachmentName: null,
        attachmentMime: null,
        attachmentBytes: null,
      }),
    ).toBeNull();
  });

  it('una fila a medias igual da algo usable', () => {
    expect(
      adjuntoDe({
        attachmentFile: 'x-foto.jpg',
        attachmentName: null,
        attachmentMime: null,
        attachmentBytes: null,
      }),
    ).toEqual({
      archivo: 'x-foto.jpg',
      nombre: 'x-foto.jpg',
      mime: 'application/octet-stream',
      bytes: 0,
    });
  });
});
