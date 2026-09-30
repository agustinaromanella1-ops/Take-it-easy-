import { useEffect, useState } from 'react';
import { useStore } from '../store/StoreContext';
import { Huellita, Salchicha } from './Salchicha';
import { nombreTruco, TRUCOS, type TrucoId } from '../lib/huellitas/huellitas';
import { sinMovimiento } from '../lib/movimiento';

/**
 * El perro en Hoy, con su huellita.
 *
 * Tocarlo repite el último truco aprendido. No pide nada, no espera nada.
 */
export function TarjetaCompanero({ texto }: { texto: string }) {
  const { data, repetirTruco } = useStore();
  const h = data.huellitas;
  const ultimo = (h.trucos[h.trucos.length - 1] ?? null) as TrucoId | null;
  const [aviso, setAviso] = useState('');

  return (
    <section className="card companero" aria-label="Tu compañero">
      <div className="companero-fila">
        <button
          type="button"
          className="perro-boton"
          aria-label={ultimo ? `Salchi. Tocalo para ver: ${nombreTruco(ultimo)}` : 'Salchi'}
          onClick={() => {
            if (ultimo) repetirTruco(ultimo);
            else setAviso('Todavía no aprendió trucos. Se aprenden completando huellitas.');
          }}
        >
          <Salchicha tam={150} etiqueta="" />
        </button>
        <p className="burbuja">{aviso || texto}</p>
      </div>
      {data.preferencias.celebraciones && (
        <div className="huella-fila">
          <Huellita llenas={h.almohadillas} tam={44} />
          <p className="susurro">
            {h.almohadillas} de 5 en esta huellita. Se llena revisando, anotando, actualizando saldos. Cada cosa cuenta una vez por día.
          </p>
        </div>
      )}
    </section>
  );
}

/**
 * La celebración: el perro entra, apoya la patita en la huella y hace su
 * truco. Dura menos de tres segundos, no tapa botones (no recibe toques) y no
 * se lleva el foco. Con movimiento reducido, es una imagen quieta.
 */
export function Celebracion() {
  const { data, celebracion, terminarCelebracion } = useStore();
  const quieto = sinMovimiento();

  useEffect(() => {
    if (!celebracion) return;
    const t = setTimeout(terminarCelebracion, celebracion.soloAlmohadilla ? 2200 : quieto ? 4000 : 3000);
    return () => clearTimeout(t);
  }, [celebracion, terminarCelebracion, quieto]);

  if (!celebracion) return null;
  const prefs = data.preferencias;
  const texto = celebracion.soloAlmohadilla
    ? `Una almohadilla más: ${data.huellitas.almohadillas} de 5.`
    : celebracion.nuevo
      ? `Huellita completa. Salchi aprendió un truco: ${nombreTruco(celebracion.truco ?? '')}.`
      : `${nombreTruco(celebracion.truco ?? '')}.`;

  // Sin celebraciones, o sin perro, queda solo el aviso para el lector de pantalla.
  const mostrar = prefs.celebraciones && prefs.companero !== 'no';

  return (
    <div className="celebracion" aria-live="polite" key={celebracion.n}>
      {mostrar && !celebracion.soloAlmohadilla && (
        <div className={`escena${quieto ? ' escena-quieta' : ''}`}>
          <Huellita llenas={5} completa tam={56} />
          <Salchicha truco={quieto ? null : celebracion.truco} tam={180} etiqueta="" />
        </div>
      )}
      {prefs.celebraciones ? <p className="celebracion-texto">{texto}</p> : <p className="solo-lector">{texto}</p>}
    </div>
  );
}

export function ListaTrucos() {
  const { data } = useStore();
  return (
    <ul className="lista-trucos">
      {TRUCOS.map((t) => {
        const sabe = data.huellitas.trucos.includes(t.id);
        return (
          <li key={t.id}>
            <span aria-hidden="true">{sabe ? '🐾' : '·'}</span> {t.nombre} <span className="susurro">{sabe ? 'aprendido' : 'todavía no'}</span>
          </li>
        );
      })}
    </ul>
  );
}
