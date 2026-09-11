import { useState } from 'react';

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
import './Asistente.css';

/**
 * El asistente, de punta a punta: escribir, revisar, enviar.
 *
 * La sesión de anonimización vive acá y en ningún otro lado. No entra en la
 * pila de navegación ni en el borrador: el mapa alias → alumno muere con esta
 * pantalla, que es lo que exige la sección 3.4 del diseño.
 */

type Paso =
  | { nombre: 'escribir' }
  | { nombre: 'revisar'; sesion: SesionDeAnonimizacion; consulta: string }
  | { nombre: 'enviado' };

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

  // El asistente es una sección, así que no tiene pila detrás: sin esto, el
  // botón atrás desde la revisión cierra la app con la consulta adentro.
  useAtras(() => {
    if (paso.nombre === 'escribir') return false;
    setPaso({ nombre: 'escribir' });
    return true;
  });

  function escribir(nuevo: string) {
    setEscrito(nuevo);
    setGuardado(sinDatosDeContacto(nuevo));
  }

  function empezarDeNuevo() {
    limpiar();
    setEscrito(null);
    setPaso({ nombre: 'escribir' });
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

  if (paso.nombre === 'revisar') {
    return (
      <Revision
        sesion={paso.sesion}
        consulta={paso.consulta}
        enviar={() => setPaso({ nombre: 'enviado' })}
        volver={() => setPaso({ nombre: 'escribir' })}
      />
    );
  }

  if (paso.nombre === 'enviado') {
    return (
      <div className="pantalla asistente">
        <header>
          <h1>Todavía no está conectado</h1>
          <p className="ayuda">
            El filtro y la revisión ya funcionan, pero el asistente todavía no
            tiene con quién hablar: falta la parte que corre en internet.
          </p>
          <p className="ayuda">
            <strong>Tu consulta no se envió a ningún lado.</strong> No salió
            nada del teléfono.
          </p>
        </header>

        <div className="pie">
          <button className="primario" onClick={() => setPaso({ nombre: 'escribir' })}>
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
