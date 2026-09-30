import { useEffect, useState } from 'react';
import { useStore } from '../store/StoreContext';
import { alHaberVersionNueva } from '../pwa';

/** La barra de deshacer: diez segundos, se frena mientras tenga el foco adentro. */
export function Deshacer() {
  const { deshacer } = useStore();
  if (!deshacer) return null;
  return (
    <div
      className="barra barra-deshacer"
      role="status"
      onFocus={() => deshacer.frenar(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) deshacer.frenar(false);
      }}
    >
      <span>{deshacer.etiqueta}.</span>
      <button className="btn chico" onClick={deshacer.hacer}>
        Deshacer
      </button>
      <button className="btn-texto" onClick={deshacer.descartar} aria-label="Cerrar aviso">
        ✕
      </button>
    </div>
  );
}

/** "Hay una versión nueva": se ve y se decide; no se recarga sola. */
export function BarraActualizar() {
  const [aplicar, setAplicar] = useState<(() => void) | null>(null);
  const [aplicando, setAplicando] = useState(false);
  useEffect(() => alHaberVersionNueva((f) => setAplicar(() => f)), []);
  if (!aplicar) return null;
  return (
    <div className="barra barra-version" role="status">
      <span>Hay una versión nueva.</span>
      <button
        className="btn chico principal"
        disabled={aplicando}
        onClick={() => {
          setAplicando(true);
          aplicar();
        }}
      >
        {aplicando ? 'Actualizando…' : 'Actualizar'}
      </button>
    </div>
  );
}

/** Si no se puede guardar, se dice. Perder trabajo sin enterarse es lo peor que puede pasar. */
export function NoSeGuarda() {
  const { noSeGuarda } = useStore();
  if (!noSeGuarda) return null;
  return (
    <div className="franja franja-error" role="alert">
      No se está pudiendo guardar en este teléfono (puede estar lleno el almacenamiento del navegador). Bajá una copia desde Ajustes antes de cerrar.
    </div>
  );
}
