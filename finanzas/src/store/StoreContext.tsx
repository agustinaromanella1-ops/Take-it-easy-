import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import type { AccionHuellita, AppData } from '../types';
import { guardarFusionando, leerLoGuardado, loadData, STORAGE_KEY } from '../lib/storage';
import { fusionar } from '../lib/fusion';
import { volverA } from '../lib/deshacer';
import { registrarAccion, type TrucoId } from '../lib/huellitas/huellitas';
import { today } from '../lib/dates';
import { etiquetaDe, reducer, type Action } from './reducer';

/**
 * El estado de la app, con guardado, deshacer y huellitas.
 *
 * Toda acción que toca los datos pasa por `dispatch`, que guarda el estado
 * anterior y ofrece deshacer. Lo mismo que en Pipí Cucú: con red, se toca y se
 * mira qué pasó; sin red, cada botón es una decisión que hay que pensar dos
 * veces, y eso es justo lo que cuesta.
 */

export interface Celebracion {
  /** Cambia en cada celebración, para volver a montar la animación. */
  n: number;
  truco: TrucoId | null;
  nuevo: boolean;
  /** Solo llenó una almohadilla. */
  soloAlmohadilla: boolean;
}

interface StoreValue {
  data: AppData;
  dispatch: (action: Action) => void;
  /** Suma una acción a la huellita. Si no suma (ya se contó hoy), no pasa nada. */
  huellita: (accion: AccionHuellita) => void;
  celebracion: Celebracion | null;
  terminarCelebracion: () => void;
  /** Repetir el último truco, tocando al perro. */
  repetirTruco: (truco: TrucoId) => void;
  deshacer: { etiqueta: string; hacer: () => void; descartar: () => void; frenar: (f: boolean) => void } | null;
  noSeGuarda: boolean;
  /** Datos de ejemplo: no se guardan nunca. */
  esEjemplo: boolean;
}

const DESHACER_MS = 10000;
const SAVE_DEBOUNCE_MS = 300;

const StoreContext = createContext<StoreValue | null>(null);

function mismosDatos(a: AppData, b: AppData): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function StoreProvider({ children, inicial }: { children: ReactNode; inicial?: AppData }) {
  const esEjemplo = inicial !== undefined;
  const [data, rawDispatch] = useReducer(reducer, undefined, () => inicial ?? loadData());
  const dirty = useRef(false);
  const firstRender = useRef(true);
  const [noSeGuarda, setNoSeGuarda] = useState(false);
  const latest = useRef(data);
  latest.current = data;

  useEffect(() => {
    if (esEjemplo) return;
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    dirty.current = true;
    const t = setTimeout(() => {
      const fusionado = guardarFusionando(latest.current);
      if (fusionado) dirty.current = false;
      setNoSeGuarda(fusionado === null);
      if (fusionado && !mismosDatos(fusionado, latest.current)) rawDispatch({ type: 'data/replace', payload: fusionado });
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [data, esEjemplo]);

  // Lo que guardó otra pestaña se fusiona, nunca se reemplaza a ciegas.
  useEffect(() => {
    if (esEjemplo) return;
    const alCambiar = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      const deLaOtra = leerLoGuardado();
      if (!deLaOtra) return;
      const fusionado = fusionar(latest.current, deLaOtra);
      if (mismosDatos(fusionado, latest.current)) return;
      rawDispatch({ type: 'data/replace', payload: fusionado });
      setUndo(null);
    };
    window.addEventListener('storage', alCambiar);
    return () => window.removeEventListener('storage', alCambiar);
  }, [esEjemplo]);

  // Si se cierra la pestaña dentro de la espera del guardado, se guarda igual.
  useEffect(() => {
    if (esEjemplo) return;
    const flush = () => {
      if (!dirty.current) return;
      if (guardarFusionando(latest.current)) dirty.current = false;
    };
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [esEjemplo]);

  const [undo, setUndo] = useState<{ etiqueta: string; estado: AppData } | null>(null);
  const [frenado, setFrenado] = useState(false);
  const [celebracion, setCelebracion] = useState<Celebracion | null>(null);
  const contador = useRef(0);

  const dispatch = useCallback((action: Action) => {
    const etiqueta = etiquetaDe(action);
    setUndo(etiqueta ? { etiqueta, estado: latest.current } : null);
    setFrenado(false);
    rawDispatch(action);
  }, []);

  const huellita = useCallback((accion: AccionHuellita) => {
    const r = registrarAccion(latest.current.huellitas, accion, today(), new Date().toISOString());
    if (!r.sumo) return;
    const { updatedAt: _u, ...h } = r.huellitas;
    rawDispatch({ type: 'huellitas/poner', huellitas: h });
    contador.current += 1;
    setCelebracion({ n: contador.current, truco: r.truco, nuevo: r.nuevo, soloAlmohadilla: r.truco === null });
  }, []);

  const repetirTruco = useCallback((truco: TrucoId) => {
    contador.current += 1;
    setCelebracion({ n: contador.current, truco, nuevo: false, soloAlmohadilla: false });
  }, []);

  useEffect(() => {
    if (!undo || frenado) return;
    const t = window.setTimeout(() => setUndo(null), DESHACER_MS);
    return () => window.clearTimeout(t);
  }, [undo, frenado]);

  const value = useMemo<StoreValue>(
    () => ({
      data,
      dispatch,
      huellita,
      celebracion,
      terminarCelebracion: () => setCelebracion(null),
      repetirTruco,
      noSeGuarda,
      esEjemplo,
      deshacer: undo
        ? {
            etiqueta: undo.etiqueta,
            hacer: () => {
              // Con sellos frescos: si no, la fusión elegiría el cambio. Ver src/lib/deshacer.ts.
              rawDispatch({ type: 'data/replace', payload: volverA(latest.current, undo.estado, new Date().toISOString()) });
              setUndo(null);
            },
            descartar: () => setUndo(null),
            frenar: setFrenado,
          }
        : null,
    }),
    [data, dispatch, huellita, celebracion, repetirTruco, noSeGuarda, esEjemplo, undo],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore debe usarse dentro de <StoreProvider>');
  return ctx;
}
