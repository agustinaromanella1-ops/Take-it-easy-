import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { AppData } from '../types';
import { guardarFusionando, leerLoGuardado, loadData, STORAGE_KEY } from '../lib/storage';
import { fusionar } from '../lib/fusion';
import { volverA } from '../lib/deshacer';
import { reducer, type Action } from './reducer';

interface StoreValue {
  data: AppData;
  dispatch: React.Dispatch<Action>;
  /** Lo último que se puede deshacer, o `null` si no hay nada. */
  deshacer: {
    etiqueta: string;
    hacer: () => void;
    descartar: () => void;
    /**
     * Frena y reanuda la cuenta regresiva. La barra la frena mientras tenga el
     * foco adentro: diez segundos alcanzan para ver un cartel, no para llegar
     * a él tabulando y decidir. Se iba con el foco puesto y lo dejaba en la
     * nada, así que la tabulación siguiente arrancaba de arriba de todo.
     */
    frenar: (frenado: boolean) => void;
  } | null;
  /**
   * Si el último intento de guardar falló.
   *
   * Pasa cuando se llena el almacenamiento del navegador, que con muchos años
   * de historia es alcanzable. Hasta ahora fallaba en silencio: la app se veía
   * normal, se seguía trabajando toda la tarde, y al cerrar no quedaba nada.
   * Son datos de salud, sin servidor y sin otra copia: es el único camino por
   * el que se pierde trabajo sin que nadie se entere.
   */
  noSeGuarda: boolean;
}

/**
 * Cómo se nombra cada cambio en la barra de deshacer, o `null` si no se
 * ofrece deshacerlo.
 *
 * Poder deshacer cambia cómo se usa una app: sin red, cada botón es una
 * decisión y hay que estar seguro antes de tocar. Con red, se toca y se mira
 * qué pasó. Eso importa siempre y más todavía cuando la atención va y viene:
 * la duda "¿toqué el botón que no era?" deja de costar el trabajo de
 * reconstruir a mano lo que se rompió.
 *
 * Ajustes queda afuera a propósito: se edita escribiendo, y ofrecer deshacer
 * en cada tecla sería ruido.
 */
function etiquetaDe(action: Action): string | null {
  switch (action.type) {
    case 'patient/add':
      return 'Guardaste un paciente';
    case 'patient/update':
      return 'Editaste un paciente';
    case 'patient/remove':
      return 'Borraste un paciente';
    case 'session/add':
      return 'Agendaste una sesión';
    case 'session/addMany':
      return 'Agendaste varias sesiones';
    case 'session/update':
      return 'Editaste una sesión';
    case 'session/remove':
      return 'Borraste una sesión';
    case 'session/setStatus':
      return 'Marcaste una sesión';
    case 'payment/add':
      return 'Registraste un cobro';
    case 'payment/remove':
      return 'Borraste un cobro';
    case 'day/close':
      return 'Cerraste el día';
    case 'data/replace':
      return 'Importaste una copia';
    default:
      return null;
  }
}

/**
 * Cuánto se queda la barra de deshacer.
 *
 * Estuvo en 30 segundos con el argumento de que el error se nota al volver a
 * mirar la pantalla, después de atender el teléfono. En el teléfono real eso
 * se ve distinto: la barra flota encima de la app y tapa lo que haya abajo
 * —en Ajustes tapaba el botón de importar—, y medio minuto así no se lee como
 * "tenés tiempo", se lee como "esto se colgó". El costo de tapar la pantalla
 * se paga siempre; el de perder la ventana, casi nunca. Además ahora se puede
 * cerrar a mano.
 */
const DESHACER_MS = 10000;

/**
 * Si dos copias de los datos son la misma cosa.
 *
 * Se compara el texto serializado porque alcanza y es barato: lo único que se
 * necesita saber es si la fusión trajo algo, para no despachar un cambio que
 * no cambia nada y volver a dibujar la app de gusto.
 */
function mismosDatos(a: AppData, b: AppData): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
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
  const [noSeGuarda, setNoSeGuarda] = useState(false);

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
      // Fusiona con lo que haya guardado otra pestaña en el ínterin, en vez de
      // pisarlo. Ver `src/lib/fusion.ts`.
      const fusionado = guardarFusionando(latest.current);
      if (fusionado) dirty.current = false;
      setNoSeGuarda(fusionado === null);
      // Si la fusión trajo algo que esta pestaña no tenía, se muestra: si no,
      // la pantalla seguiría mostrando una foto vieja de datos que ya cambiaron.
      if (fusionado && !mismosDatos(fusionado, latest.current)) {
        dispatch({ type: 'data/replace', payload: fusionado });
      }
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [data]);

  /**
   * Enterarse de lo que guardó otra pestaña.
   *
   * El evento `storage` llega solo a las OTRAS pestañas del mismo origen, así
   * que no hay eco. Lo que llega se fusiona con lo que esta pestaña tiene en
   * memoria —puede haber algo escrito y todavía sin guardar—, nunca se
   * reemplaza a ciegas.
   */
  useEffect(() => {
    const alCambiar = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      const deLaOtra = leerLoGuardado();
      if (!deLaOtra) return;
      const fusionado = fusionar(latest.current, deLaOtra);
      if (mismosDatos(fusionado, latest.current)) return;
      dispatch({ type: 'data/replace', payload: fusionado });
      // Deshacer se arma sobre una foto que acaba de quedar vieja: ofrecerlo
      // ahora sería prometer volver a un estado que ya no existe.
      setUndo(null);
    };
    window.addEventListener('storage', alCambiar);
    return () => window.removeEventListener('storage', alCambiar);
  }, []);

  // Si se cierra la pestaña dentro de la ventana del debounce, el último
  // cambio se perdería. Este flush lo persiste antes de salir.
  useEffect(() => {
    const flush = () => {
      if (!dirty.current) return;
      if (guardarFusionando(latest.current)) dirty.current = false;
    };
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, []);

  /**
   * El estado de antes del último cambio. Se guarda entero: son pocos kilobytes
   * y así deshacer no depende de saber invertir cada acción una por una.
   */
  const [undo, setUndo] = useState<{ etiqueta: string; estado: AppData } | null>(null);
  const [frenado, setFrenado] = useState(false);

  const despachar = useCallback((action: Action) => {
    const etiqueta = etiquetaDe(action);
    // Todo cambio pisa el punto de retorno, tenga etiqueta o no: si no, deshacer
    // volvería más atrás de lo que la barra promete y se llevaría puesto lo que
    // se hizo después.
    setUndo(etiqueta ? { etiqueta, estado: latest.current } : null);
    setFrenado(false);
    dispatch(action);
  }, []);

  // La barra se va sola. El temporizador se rearma con cada cambio nuevo.
  useEffect(() => {
    if (!undo || frenado) return;
    const t = window.setTimeout(() => setUndo(null), DESHACER_MS);
    return () => window.clearTimeout(t);
  }, [undo, frenado]);

  const value = useMemo<StoreValue>(
    () => ({
      data,
      dispatch: despachar,
      noSeGuarda,
      deshacer: undo
        ? {
            etiqueta: undo.etiqueta,
            hacer: () => {
              // `dispatch` crudo, no `despachar`: volver atrás no es un cambio
              // nuevo que se pueda deshacer otra vez.
              //
              // Y no se repone la foto tal cual: `volverA` la devuelve con
              // sellos frescos. Con los viejos, la fusión contra lo ya
              // guardado —que tiene el cambio, más nuevo— elegiría el cambio y
              // el deshacer no haría nada. Ver `src/lib/deshacer.ts`.
              dispatch({
                type: 'data/replace',
                payload: volverA(latest.current, undo.estado, new Date().toISOString()),
              });
              setUndo(null);
            },
            descartar: () => setUndo(null),
            frenar: setFrenado,
          }
        : null,
    }),
    [data, despachar, undo, noSeGuarda],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore debe usarse dentro de <StoreProvider>');
  return ctx;
}
