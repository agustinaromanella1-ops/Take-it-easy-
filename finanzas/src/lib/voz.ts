/**
 * Dictado por voz, opcional.
 *
 * Usa el reconocimiento de voz del navegador. En Chrome, el audio se manda a
 * los servidores de Google para pasarlo a texto: eso contradice "nada sale
 * del dispositivo", así que viene apagado y Ajustes lo dice antes de
 * prenderlo. Lo que se dicta pasa por el mismo analizador que una frase
 * escrita, y siempre se muestra antes de guardar.
 */

interface Reconocimiento {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type Constructor = new () => Reconocimiento;

function constructor(): Constructor | null {
  const w = window as unknown as { SpeechRecognition?: Constructor; webkitSpeechRecognition?: Constructor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function hayVoz(): boolean {
  try {
    return constructor() !== null;
  } catch {
    return false;
  }
}

/** Escucha una frase. Devuelve una función para cortar. */
export function dictar(alTexto: (texto: string) => void, alError: (mensaje: string) => void, alTerminar: () => void): () => void {
  const C = constructor();
  if (!C) {
    alError('Este navegador no permite dictar.');
    alTerminar();
    return () => {};
  }
  const r = new C();
  r.lang = 'es-AR';
  r.interimResults = false;
  r.maxAlternatives = 1;
  r.onresult = (e) => {
    const texto = e.results[0]?.[0]?.transcript ?? '';
    if (texto) alTexto(texto);
  };
  r.onerror = (e) => {
    alError(
      e.error === 'not-allowed' || e.error === 'service-not-allowed'
        ? 'No hay permiso para usar el micrófono.'
        : e.error === 'no-speech'
          ? 'No escuché nada. Probá de nuevo o escribilo.'
          : 'No se pudo dictar. Podés escribirlo.',
    );
  };
  r.onend = alTerminar;
  r.start();
  return () => r.stop();
}
