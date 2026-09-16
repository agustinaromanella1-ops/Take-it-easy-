import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Recordatorio de que la app mide el trabajo, no a la persona que lo hace.
 * Tocar al perrito cambia el mensaje y lo hace volar.
 *
 * Es el mismo perro de la portada —el GIF aprobado, sin redibujar— pero acá
 * está quieto: es el primer fotograma. Un dibujo animado dando vueltas para
 * siempre al lado de los números del mes cansa y distrae; que vuele solo
 * cuando lo tocan lo deja como lo que es, un guiño.
 */
const VUELO_MS = 2600;
const MESSAGES = [
  'Tus números no definen tu valor ✨',
  'Un paciente a la vez 🌱',
  'Cobrar tu trabajo también es cuidarte 💙',
  'Los meses flojos también son parte 🍃',
  'Acordate de descansar entre sesiones ☕',
  'Lo que no se registra, no se cobra 📝',
];

const WEEKDAY_MESSAGES: Record<number, string> = {
  1: '¡Arranca la semana! 💪',
  5: 'Casi es viernes 😛',
  6: 'Buen fin de semana 🌿',
  0: 'Domingo de recargar 🌙',
};

export function Mascot() {
  const initial = useMemo(() => WEEKDAY_MESSAGES[new Date().getDay()] ?? MESSAGES[0]!, []);
  const [message, setMessage] = useState(initial);
  const [volando, setVolando] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const vuelos = useRef(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const next = useCallback(() => {
    // Si el sistema pide menos movimiento, el perro cambia de mensaje pero no
    // vuela: el movimiento es adorno y no vale la distracción.
    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    setMessage((current) => {
      const options = MESSAGES.filter((m) => m !== current);
      return options[Math.floor(Math.random() * options.length)] ?? current;
    });

    if (quieto) return;
    // El contador remonta la imagen, así el GIF arranca de nuevo aunque ya
    // estuviera volando.
    vuelos.current += 1;
    setVolando(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setVolando(false), VUELO_MS);
  }, []);

  return (
    <div className="mascot">
      <span className="mascot-bubble">{message}</span>
      <button className="mascot-dog" onClick={next} aria-label="Otro mensaje" title="Tocame">
        <img
          key={vuelos.current}
          src={volando ? '/pipi-cucu-dog-flying.gif' : '/pipi-cucu-dog-static.png'}
          alt="Perro salchicha"
          width={483}
          height={177}
          decoding="async"
        />
      </button>
    </div>
  );
}
