import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Recordatorio de que la app mide el trabajo, no a la persona que lo hace.
 * Tocar al perrito saca un mensaje y lo hace volar.
 *
 * Arranca callado a propósito: si el mensaje ya está ahí al abrir la app, deja
 * de ser un hallazgo y pasa a ser un cartel más compitiendo por la atención
 * justo cuando entrás a ver tus números.
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
  // El primer mensaje es el del día de la semana; los siguientes salen al azar.
  const primero = useMemo(() => WEEKDAY_MESSAGES[new Date().getDay()] ?? MESSAGES[0]!, []);
  const [message, setMessage] = useState<string | null>(null);
  const [volando, setVolando] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const vuelos = useRef(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const next = useCallback(() => {
    // Si el sistema pide menos movimiento, el perro cambia de mensaje pero no
    // vuela: el movimiento es adorno y no vale la distracción.
    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    setMessage((current) => {
      if (current === null) return primero;
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
  }, [primero]);

  return (
    <div className="mascot">
      {message !== null && <span className="mascot-bubble">{message}</span>}
      <button className="mascot-dog" onClick={next} aria-label="Un mensaje del perrito" title="Tocame">
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
