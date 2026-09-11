import { useRef, useState } from 'react';

import { useAtras } from '../hooks/useAtras';
import { useBorrador } from '../hooks/useBorrador';
import Consulta from './Consulta';
import Revision from './Revision';
import {
  crearSesionDeAnonimizacion,
  sinDatosDeContacto,
  tieneDatosDeContacto,
  type SesionDeAnonimizacion,
} from './anonimizacion';
import { contextoDelAsistente } from './contexto';
import { hayAsistente, preguntar } from './enviar';
import './Asistente.css';

/**
 * El asistente, de punta a punta: escribir, revisar, enviar, leer.
 *
 * La sesión de anonimización vive acá y en ningún otro lado. No entra en la
 * pila de navegación ni en el borrador: el mapa alias → alumno muere con esta
 * pantalla, que es lo que exige la sección 3.4 del diseño.
 */

type Paso =
  | { nombre: 'escribir' }
  | { nombre: 'revisar'; sesion: SesionDeAnonimizacion; consulta: string }
  | { nombre: 'respuesta'; sesion: SesionDeAnonimizacion };

export default function Asistente() {
  // Lo escrito a medias sí se guarda: es texto local de la docente, igual que
  // una observación. Lo que nunca se guarda es el mapa de alias.
  const { valor: guardado, setValor: setGuardado, limpiar, listo } = useBorrador('asistente', '');
  // Lo que se ve es lo que escribió, con el correo y todo; a la base va la
  // versión sin esos datos, porque la app promete no guardarlos. Mientras no
  // escribió nada, se muestra lo que volvió del borrador.
  const [escrito, setEscrito] = useState<string | null>(null);
  const texto = escrito ?? guardado;

  const [paso, setPaso] = useState<Paso>({ nombre: 'escribir' });
  const [preparando, setPreparando] = useState(false);
  const [falla, setFalla] = useState(false);

  // La respuesta se guarda con los alias puestos y se re-personaliza recién
  // para mostrarla: hacerlo trozo por trozo partiría un alias al medio cuando
  // "Estudiante" y " A" llegan en pedazos distintos.
  const [conAlias, setConAlias] = useState('');
  const [errorDeEnvio, setErrorDeEnvio] = useState<string | null>(null);
  const [esperando, setEsperando] = useState(false);
  const enCurso = useRef<AbortController | null>(null);

  function volverAEscribir() {
    enCurso.current?.abort();
    enCurso.current = null;
    setPaso({ nombre: 'escribir' });
  }

  // El asistente es una sección, así que no tiene pila detrás: sin esto, el
  // botón atrás desde la revisión cierra la app con la consulta adentro.
  useAtras(() => {
    if (paso.nombre === 'escribir') return false;
    volverAEscribir();
    return true;
  });

  function escribir(nuevo: string) {
    setEscrito(nuevo);
    setGuardado(sinDatosDeContacto(nuevo));
  }

  function empezarDeNuevo() {
    limpiar();
    setEscrito(null);
    volverAEscribir();
  }

  async function revisar() {
    if (preparando) return;
    setPreparando(true);
    setFalla(false);
    try {
      const sesion = crearSesionDeAnonimizacion(await contextoDelAsistente());
      setPaso({ nombre: 'revisar', sesion, consulta: texto });
    } catch {
      // Si leer los alumnos falla, el filtro no tiene contra qué comparar.
      // Avanzar igual sería enviar sin filtrar, así que no se avanza.
      setFalla(true);
    } finally {
      setPreparando(false);
    }
  }

  async function enviar(sesion: SesionDeAnonimizacion, filtrado: string) {
    const corte = new AbortController();
    enCurso.current = corte;

    setPaso({ nombre: 'respuesta', sesion });
    setConAlias('');
    setErrorDeEnvio(null);
    setEsperando(true);

    const { error } = await preguntar(filtrado, setConAlias, corte.signal);

    // Si mientras tanto volvió a la consulta, lo que llegó ya no va a ningún lado.
    if (corte.signal.aborted) return;
    setErrorDeEnvio(error);
    setEsperando(false);
  }

  if (paso.nombre === 'revisar') {
    return (
      <Revision
        sesion={paso.sesion}
        consulta={paso.consulta}
        enviar={(filtrado) => void enviar(paso.sesion, filtrado)}
        volver={volverAEscribir}
      />
    );
  }

  if (paso.nombre === 'respuesta') {
    // Los nombres reales vuelven acá, en el teléfono. Nunca salieron de él.
    const conNombres = paso.sesion.rePersonalizar(conAlias);
    const vacia = conNombres === '';

    return (
      <div className="pantalla asistente">
        <header>
          <button className="volver" onClick={volverAEscribir}>
            ← Volver a la consulta
          </button>
          <h1>{errorDeEnvio && vacia ? 'No se pudo' : 'La respuesta'}</h1>
        </header>

        {!vacia && <p className="respuesta">{conNombres}</p>}
        {esperando && vacia && <p className="ayuda">Pensando…</p>}

        {errorDeEnvio && (
          <p className="bloqueo">
            {errorDeEnvio}
            {!hayAsistente && ' Tu consulta no salió del teléfono.'}
          </p>
        )}

        <div className="pie">
          <button className="primario" onClick={volverAEscribir}>
            Volver a la consulta
          </button>
          <button className="secundario" onClick={empezarDeNuevo}>
            Empezar de nuevo
          </button>
        </div>
      </div>
    );
  }

  return (
    <Consulta
      texto={texto}
      escribir={escribir}
      revisar={revisar}
      listo={listo}
      preparando={preparando}
      avisarDelBorrador={tieneDatosDeContacto(texto)}
      falla={falla}
    />
  );
}
