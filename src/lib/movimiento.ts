/**
 * Preferencia de animaciones.
 *
 * Por defecto manda el sistema: quien pidió menos movimiento en su
 * computadora o su teléfono no debería ver ninguno, porque para varias
 * personas el movimiento no es adorno sino una distracción o un malestar.
 *
 * Pero ese ajuste se prende sin querer —el ahorro de batería de Android lo
 * activa solo— y desde adentro de la app no hay forma de saber por qué el
 * perro dejó de volar. Por eso se puede decidir acá también: el valor de
 * fábrica sigue respetando al sistema y quien quiera lo cambia a mano.
 */
export type Animaciones = 'auto' | 'siempre' | 'nunca';

const CLAVE = 'pipicucu:animaciones';

export function leerAnimaciones(): Animaciones {
  try {
    const v = localStorage.getItem(CLAVE);
    return v === 'siempre' || v === 'nunca' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

/** Si corresponde no mover nada, mirando la preferencia y después el sistema. */
export function sinMovimiento(): boolean {
  const elegido = leerAnimaciones();
  if (elegido === 'siempre') return false;
  if (elegido === 'nunca') return true;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Deja la elección en el html, que es contra lo que consulta el CSS. */
export function aplicarAnimaciones(valor: Animaciones): void {
  document.documentElement.dataset.animaciones = valor;
}

export function guardarAnimaciones(valor: Animaciones): void {
  try {
    if (valor === 'auto') localStorage.removeItem(CLAVE);
    else localStorage.setItem(CLAVE, valor);
  } catch {
    /* Sin almacenamiento vuelve a "según el sistema" al recargar. */
  }
  aplicarAnimaciones(valor);
}
