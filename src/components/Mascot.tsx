import { useCallback, useMemo, useState } from 'react';

/**
 * Recordatorio de que la app mide el trabajo, no a la persona que lo hace.
 * Tocar al perrito cambia el mensaje.
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

  const next = useCallback(() => {
    setMessage((current) => {
      const options = MESSAGES.filter((m) => m !== current);
      return options[Math.floor(Math.random() * options.length)] ?? current;
    });
  }, []);

  return (
    <div className="mascot">
      <span className="mascot-bubble">{message}</span>
      <button className="mascot-dog" onClick={next} aria-label="Otro mensaje" title="Tocame">
        🐕
      </button>
    </div>
  );
}
