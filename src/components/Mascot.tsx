import { useCallback, useMemo, useRef, useState } from 'react';
import { Dachshund } from './Dachshund';

/**
 * Recordatorio de que la app mide el trabajo, no a la persona que lo hace.
 * Tocar al perrito cambia el mensaje y le mueve la cola.
 */
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
  const [wagging, setWagging] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  const next = useCallback(() => {
    // Si el sistema pide menos movimiento, el perro cambia de mensaje pero no
    // mueve la cola: el movimiento es adorno y no vale la distracción.
    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    setMessage((current) => {
      const options = MESSAGES.filter((m) => m !== current);
      return options[Math.floor(Math.random() * options.length)] ?? current;
    });
    // Se remonta el SVG para reiniciar la animación de la cola aunque ya
    // estuviera moviéndose.
    if (quieto) return;
    setWagging(false);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setWagging(true), 10);
  }, []);

  return (
    <div className="mascot">
      <span className="mascot-bubble">{message}</span>
      <button className="mascot-dog" onClick={next} aria-label="Otro mensaje" title="Tocame">
        <Dachshund wag={wagging} />
      </button>
    </div>
  );
}
