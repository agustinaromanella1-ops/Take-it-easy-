/**
 * Tema claro / oscuro.
 *
 * La preferencia vive en el dispositivo y no en los datos de la app: es cómo
 * se ve acá, no información de trabajo. Si viajara en la copia de seguridad,
 * restaurarla en otro teléfono le cambiaría el tema a esa persona.
 *
 * "Automático" sigue al sistema, que es lo que espera quien tiene el teléfono
 * programado para oscurecerse de noche.
 */
export type Tema = 'auto' | 'claro' | 'oscuro';

const CLAVE = 'pipicucu:tema';

/** Los colores de fondo de cada tema, para la barra del navegador. */
const BARRA: Record<'claro' | 'oscuro', string> = {
  claro: '#d9ebfb',
  oscuro: '#1a1533',
};

export function leerTema(): Tema {
  try {
    const v = localStorage.getItem(CLAVE);
    return v === 'claro' || v === 'oscuro' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

/** Qué tema corresponde mostrar ahora mismo. */
export function temaEfectivo(tema: Tema): 'claro' | 'oscuro' {
  if (tema !== 'auto') return tema;
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro';
  } catch {
    return 'claro';
  }
}

/** Pinta el tema y deja la barra del navegador del mismo color que la app. */
export function aplicarTema(tema: Tema): void {
  const efectivo = temaEfectivo(tema);
  document.documentElement.dataset.tema = efectivo;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', BARRA[efectivo]);
}

export function guardarTema(tema: Tema): void {
  try {
    if (tema === 'auto') localStorage.removeItem(CLAVE);
    else localStorage.setItem(CLAVE, tema);
  } catch {
    /* Sin almacenamiento, el tema vuelve a "automático" al recargar. */
  }
  aplicarTema(tema);
}

/**
 * Mientras esté en "automático", seguir al sistema en vivo: si el teléfono se
 * oscurece a la noche, la app lo acompaña sin recargar.
 */
export function seguirAlSistema(leer: () => Tema): () => void {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const alCambiar = () => {
    if (leer() === 'auto') aplicarTema('auto');
  };
  mq.addEventListener('change', alCambiar);
  return () => mq.removeEventListener('change', alCambiar);
}
