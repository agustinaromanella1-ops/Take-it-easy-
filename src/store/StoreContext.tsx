import { createContext, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';
import type { AppData } from '../types';
import { loadData, saveData } from '../lib/storage';
import { reducer, type Action } from './reducer';

interface StoreValue {
  data: AppData;
  dispatch: React.Dispatch<Action>;
}

const StoreContext = createContext<StoreValue | null>(null);

/** Milisegundos de espera antes de escribir a localStorage. Evita serializar
 *  todo el dataset en cada tecla de un formulario. */
const SAVE_DEBOUNCE_MS = 300;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, dispatch] = useReducer(reducer, undefined, loadData);

  /**
   * Si hay cambios de esta pestaña todavía no escritos a disco.
   *
   * Importa para el flush de `pagehide`: sin esta bandera, una pestaña que
   * nunca tocó nada igual escribiría su copia al cerrarse, pisando lo que
   * guardó otra pestaña abierta en paralelo. Guardar solo cuando hay algo
   * propio que guardar evita esa pérdida de datos.
   */
  const dirty = useRef(false);
  const firstRender = useRef(true);

  // `data` se lee dentro de los listeners; la ref lo mantiene fresco sin
  // tener que reinstalarlos en cada cambio de estado.
  const latest = useRef(data);
  latest.current = data;

  useEffect(() => {
    // No reescribir en el primer render: sería guardar lo que se acaba de leer.
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    dirty.current = true;
    const t = setTimeout(() => {
      if (saveData(latest.current)) dirty.current = false;
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [data]);

  // Si se cierra la pestaña dentro de la ventana del debounce, el último
  // cambio se perdería. Este flush lo persiste antes de salir.
  useEffect(() => {
    const flush = () => {
      if (!dirty.current) return;
      if (saveData(latest.current)) dirty.current = false;
    };
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, []);

  const value = useMemo(() => ({ data, dispatch }), [data]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore debe usarse dentro de <StoreProvider>');
  return ctx;
}
