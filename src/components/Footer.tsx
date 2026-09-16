import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
  'Tus números no definen tu valor ✨',
  'Un paciente a la vez 🌱',
  'Cobrar tu trabajo también es cuidarte 💙',
  'Los meses flojos también son parte 🍃',
  'Acordate de descansar entre sesiones ☕',
  'Lo que no se registra, no se cobra 📝',
];

const POR_DIA: Record<number, string> = {
  1: '¡Arranca la semana! 💪',
  5: 'Casi es viernes 😛',
  6: 'Buen fin de semana 🌿',
  0: 'Domingo de recargar 🌙',
};

export function Footer() {
  // El primero es el del día de la semana; los siguientes salen al azar.
  const primero = useMemo(() => POR_DIA[new Date().getDay()] ?? MENSAJES[0]!, []);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [volando, setVolando] = useState(false);
  const reloj = useRef<number | undefined>(undefined);
  const vuelos = useRef(0);

  useEffect(() => () => window.clearTimeout(reloj.current), []);

  const tocar = useCallback(() => {
    // Si el sistema pide menos movimiento, el perro cambia de mensaje pero no
    // vuela: el movimiento es adorno y no vale la distracción.
    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    setMensaje((actual) => {
      if (actual === null) return primero;
      const otros = MENSAJES.filter((m) => m !== actual);
      return otros[Math.floor(Math.random() * otros.length)] ?? actual;
    });

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
