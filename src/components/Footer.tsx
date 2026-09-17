import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sinMovimiento } from '../lib/movimiento';

/**
 * El pie de la app: el perrito y el eslogan, al final de cada sección.
 *
 * Está en todas las pantallas a propósito. Es lo último que se ve al bajar y
 * le pone una nota cálida a una app que, si no, sería una planilla de números;
 * y de paso cierra la página en lugar de dejarla colgada después del último
 * dato.
 *
 * El perro es el mismo de la portada —el dibujo aprobado, sin redibujar— y acá
 * está quieto: es el primer fotograma. Tocarlo saca un mensaje y lo hace volar
 * un par de segundos. Arranca callado: si el mensaje ya estuviera ahí, dejaría
 * de ser un hallazgo y sería un cartel más.
 */
const VUELO_MS = 2600;

const MENSAJES = [
  // Cuidarse mientras se trabaja
  'Acordate de tomar agua 💧',
  '¿Ya comiste algo hoy? 🍅',
  'Relaja los hombros, afloja la mandíbula 💆🏻',
  '¿Te tomaste un break hoy? ⭐',
  'Desconectá después de completar 🌸',
  'Acordate de descansar entre sesiones ☕',
  'Estirá la espalda, que el sillón no perdona 🪑',
  'Tomate cinco minutos entre paciente y paciente ⏳',

  // Bajarle el precio a la exigencia
  'Tus números no definen tu valor ✨',
  'Un paciente a la vez 🌱',
  'Los meses flojos también son parte 🍃',
  'Hoy también hiciste suficiente 🌾',
  'El cansancio no se factura, pero existe 😮‍💨',
  '¿Cuándo fue la última vez que no hiciste nada? 🛋️',

  // Cobrar sin culpa
  'Cobrar tu trabajo también es cuidarte 💙',
  'Tu tiempo vale lo que cobrás 💫',
  'Lo que no se registra, no se cobra 📝',

  // Sin más pretensión que hacer reír
  'Manifestando vacaciones 🏞️',
  '🤑🤑🤑',
];

/* Algunos días piden lo suyo. Los que no están acá sacan una del montón. */
const POR_DIA: Record<number, string> = {
  1: '¡Arranca la semana! 💪',
  4: 'Casi es viernes 😛',
  5: '¡Viernes! 🎉',
  6: 'Buen fin de semana 🌿',
  0: 'Domingo de recargar 🌙',
};

function alAzar(excepto?: string | null): string {
  const otros = excepto ? MENSAJES.filter((m) => m !== excepto) : MENSAJES;
  return otros[Math.floor(Math.random() * otros.length)] ?? MENSAJES[0]!;
}

export function Footer() {
  // El primero es el del día de la semana si ese día tiene el suyo; si no,
  // sale una al azar. Antes, los días sin mensaje propio caían siempre en la
  // misma frase, que era la primera de la lista.
  const primero = useMemo(() => POR_DIA[new Date().getDay()] ?? alAzar(), []);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [volando, setVolando] = useState(false);
  const reloj = useRef<number | undefined>(undefined);
  const vuelos = useRef(0);

  useEffect(() => () => window.clearTimeout(reloj.current), []);

  const tocar = useCallback(() => {
    // Con las animaciones apagadas, el perro cambia de mensaje pero no vuela:
    // el movimiento es adorno y no vale la distracción.
    const quieto = sinMovimiento();

    setMensaje((actual) => (actual === null ? primero : alAzar(actual)));

    if (quieto) return;
    // El contador remonta la imagen, así el GIF arranca de nuevo aunque ya
    // estuviera volando.
    vuelos.current += 1;
    setVolando(true);
    window.clearTimeout(reloj.current);
    reloj.current = window.setTimeout(() => setVolando(false), VUELO_MS);
  }, [primero]);

  return (
    <footer className="app-footer">
      {mensaje !== null && <p className="footer-bubble">{mensaje}</p>}
      <div className="footer-row">
        <button className="footer-dog" onClick={tocar} aria-label="Un mensaje del perrito" title="Tocame">
          <img
            key={vuelos.current}
            src={volando ? '/pipi-cucu-dog-flying.gif' : '/pipi-cucu-dog-static.png'}
            alt="Perro salchicha"
            width={483}
            height={177}
            decoding="async"
          />
        </button>
        <span className="footer-slogan">Tu agenda, Pipí Cucú</span>
      </div>
    </footer>
  );
}
