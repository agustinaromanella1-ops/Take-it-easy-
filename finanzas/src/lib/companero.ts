import type { Trato } from '../types';

/**
 * Lo que dice el salchicha. Una biblioteca fija, escrita a mano: sin IA, sin
 * sorpresas. No felicita decisiones de plata; reconoce revisar, anotar,
 * aclarar y retomar.
 */
export type Momento =
  | 'regreso'
  | 'anotar'
  | 'varios-pendientes'
  | 'deficit'
  | 'listo'
  | 'usar-reserva'
  | 'saludo'
  | 'sin-datos'
  | 'revisar';

export function mensaje(momento: Momento, trato: Trato): string {
  switch (momento) {
    case 'regreso':
      return 'Podemos seguir desde hoy. Vamos de a poquito.';
    case 'anotar':
      return 'Anotarlo te ayuda a entenderlo. Acá no hay retos.';
    case 'varios-pendientes':
      return '¿Miramos uno? El resto puede esperar.';
    case 'deficit':
      return 'El plan se puede ajustar. Veamos qué necesitás ahora.';
    case 'listo':
      return trato === 'femenino' ? 'Listo por hoy. Podés cerrar tranquila.' : trato === 'masculino' ? 'Listo por hoy. Podés cerrar tranquilo.' : 'Listo por hoy. Ya podés cerrar.';
    case 'usar-reserva':
      return 'La preparaste para ayudarte en momentos así.';
    case 'sin-datos':
      return 'Cuando quieras, contame cuánto tenés. Con una cuenta alcanza.';
    case 'revisar':
      return 'Mirar los números ya es hacer algo.';
    case 'saludo':
      return 'Acá estoy. Si querés anotar algo, el botón está abajo.';
  }
}
