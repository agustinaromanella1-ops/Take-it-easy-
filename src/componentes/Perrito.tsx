import { useEffect, useState } from 'react';

import './Perrito.css';

/**
 * El perrito salchicha, que es el easter egg de la app.
 *
 * Son los dos archivos que dibujó Agustina, usados tal cual: `perrito.gif`
 * mueve la cola en bucle y `perrito.png` es la misma pose quieta. No hay
 * ninguna animación de la app encima del personaje —el único movimiento es el
 * que ya trae el GIF— ni recuadro de fondo: se apoya sobre el fondo que haya.
 *
 * Un `<img>` reproduce un GIF animado solo, así que no hace falta ninguna
 * dependencia ni convertir el archivo a otro formato. Viven en `public/`, que
 * Vite copia sin tocar: si pasaran por el empaquetador, un GIF de 128 KB
 * terminaría incrustado en el JavaScript de toda la app.
 *
 * Es decorativo: no recibe foco, no se anuncia y no responde al toque.
 */

function pideQuieto(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function Perrito() {
  // Quien tenga pedido en el sistema que se reduzcan las animaciones recibe el
  // dibujo detenido. Son dos archivos porque un GIF animado no se puede frenar
  // desde CSS.
  const [quieto, setQuieto] = useState(pideQuieto);

  useEffect(() => {
    if (!window.matchMedia) return;
    const consulta = window.matchMedia('(prefers-reduced-motion: reduce)');
    const alCambiar = () => setQuieto(consulta.matches);
    consulta.addEventListener('change', alCambiar);
    return () => consulta.removeEventListener('change', alCambiar);
  }, []);

  return (
    <img
      className="perrito"
      src={quieto ? '/perrito.png' : '/perrito.gif'}
      alt=""
      aria-hidden="true"
      draggable={false}
      width={480}
      height={320}
    />
  );
}
