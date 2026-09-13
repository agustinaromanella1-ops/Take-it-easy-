import { useEffect, useState } from 'react';

/**
 * Pantalla de bienvenida: la marca por un instante al abrir la app.
 *
 * Usa el logo real en lugar de un dibujo aproximado. El archivo está optimizado
 * a 15 KB —del original de 1,1 MB— y entra en la precarga del service worker,
 * así aparece también sin conexión.
 *
 * Dura poco a propósito y se puede saltear tocándola: una animación que se
 * interpone entre la persona y lo que vino a hacer deja de ser encanto y pasa a
 * ser una demora, y esta app se abre varias veces por día.
 */
const DURACION_MS = 1600;

export function Splash() {
  const [estado, setEstado] = useState<'visible' | 'saliendo' | 'fuera'>('visible');

  useEffect(() => {
    // Con movimiento reducido no hay desvanecido: aparece y se va.
    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const salir = window.setTimeout(() => setEstado(quieto ? 'fuera' : 'saliendo'), DURACION_MS);
    return () => window.clearTimeout(salir);
  }, []);

  if (estado === 'fuera') return null;

  return (
    <div
      className={`splash${estado === 'saliendo' ? ' is-leaving' : ''}`}
      onAnimationEnd={() => setEstado('fuera')}
      onClick={() => setEstado('fuera')}
    >
      <img
        src="/logo.webp"
        alt="Pipí Cucú — tu agenda, pipí cucú"
        className="splash-logo"
        width={900}
        height={600}
      />
    </div>
  );
}
