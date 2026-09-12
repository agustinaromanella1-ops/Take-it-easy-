import { useEffect, useRef, useState } from 'react';

import {
  CopiaInvalidaError,
  armarCopia,
  deshacerRestauracion,
  leerCopia,
  nombreDeArchivo,
  restaurar,
  resumirCopia,
  type Copia,
  type Resumen,
} from '../datos/exportacion';
import {
  cancelarLaPrueba,
  elSistemaLoTiene,
  probarAhora,
  probarElAviso,
  quePasoConLaPrueba,
  textoDeLaPrueba,
  type QuePaso,
  type Resultado,
} from '../agenda/prueba';
import { olvidarInstructivo } from '../datos/preferencias';
import { guardarArchivo } from '../nativo/archivos';
import './Ajustes.css';

function enPalabras(r: Resumen): string {
  const partes = [
    `${r.materias} ${r.materias === 1 ? 'materia' : 'materias'}`,
    `${r.alumnos} ${r.alumnos === 1 ? 'alumno' : 'alumnos'}`,
    `${r.clases} ${r.clases === 1 ? 'clase' : 'clases'}`,
  ];
  if (r.observaciones > 0) {
    partes.push(`${r.observaciones} ${r.observaciones === 1 ? 'observación' : 'observaciones'}`);
  }
  return partes.join(', ');
}

export default function Ajustes({ verInstructivo }: { verInstructivo: () => void }) {
  const archivo = useRef<HTMLInputElement>(null);
  const [exportando, setExportando] = useState(false);
  const [porRestaurar, setPorRestaurar] = useState<Copia | null>(null);
  const [actual, setActual] = useState<Resumen | null>(null);
  const [restaurada, setRestaurada] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prueba, setPrueba] = useState<Resultado | null>(null);
  const [anotado, setAnotado] = useState<boolean | null>(null);
  // La pregunta que importa hay que hacerla después de cerrar la app, así que
  // se hace al abrir esta pantalla y no al apretar el botón.
  const [quePaso, setQuePaso] = useState<QuePaso>('sin-prueba');

  useEffect(() => {
    let vigente = true;
    void quePasoConLaPrueba().then((r) => {
      if (vigente) setQuePaso(r);
    });
    return () => {
      vigente = false;
    };
  }, [prueba]);

  async function exportar() {
    if (exportando) return;
    setExportando(true);
    setError(null);
    try {
      const copia = await armarCopia();
      await guardarArchivo(nombreDeArchivo(), JSON.stringify(copia, null, 2));
    } catch {
      setError('No se pudo guardar el archivo. Probá de nuevo.');
    } finally {
      setExportando(false);
    }
  }

  async function elegirArchivo(entrada: HTMLInputElement) {
    const elegido = entrada.files?.[0];
    entrada.value = '';
    if (!elegido) return;

    setError(null);
    try {
      const copia = leerCopia(await elegido.text());
      setActual(resumirCopia(await armarCopia()));
      setPorRestaurar(copia);
    } catch (e) {
      setError(e instanceof CopiaInvalidaError ? e.message : 'No se pudo leer el archivo.');
    }
  }

  async function confirmarRestaurar() {
    if (!porRestaurar) return;
    await restaurar(porRestaurar);
    setPorRestaurar(null);
    setRestaurada(true);
  }

  async function deshacer() {
    await deshacerRestauracion();
    setRestaurada(false);
  }

  return (
    <div className="pantalla ajustes">
      <header>
        <h1>Ajustes</h1>
      </header>

      <section>
        <h2>Copia de seguridad</h2>
        <p className="detalle">
          Lo que cargás vive sólo en este teléfono. Si Android libera espacio o
          el teléfono se rompe, esta copia es lo único que queda.
        </p>
        <p className="aviso">
          El archivo tiene los nombres de tus alumnos. Guardalo donde guardarías
          una libreta.
        </p>
        <button className="secundario" onClick={exportar} disabled={exportando}>
          {exportando ? 'Guardando…' : 'Guardar una copia'}
        </button>
      </section>

      <section>
        <h2>Restaurar</h2>
        {restaurada ? (
          <div className="hecho">
            <span>Se restauró la copia.</span>
            <button onClick={deshacer}>Deshacer</button>
          </div>
        ) : porRestaurar ? (
          <>
            <p className="detalle">
              La copia tiene {enPalabras(resumirCopia(porRestaurar))}.
            </p>
            {actual && (actual.materias > 0 || actual.alumnos > 0) && (
              <p className="aviso">
                Ahora tenés {enPalabras(actual)}. Restaurar reemplaza todo eso,
                aunque vas a poder deshacerlo.
              </p>
            )}
            <button className="primario" onClick={confirmarRestaurar}>
              Reemplazar todo con esta copia
            </button>
            <button className="terciario" onClick={() => setPorRestaurar(null)}>
              Mejor no
            </button>
          </>
        ) : (
          <>
            <p className="detalle">
              Elegí un archivo guardado antes para volver a tener todo como
              estaba.
            </p>
            <button className="secundario" onClick={() => archivo.current?.click()}>
              Elegir un archivo
            </button>
            <input
              ref={archivo}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => elegirArchivo(e.currentTarget)}
            />
          </>
        )}
        {error && <p className="error">{error}</p>}
      </section>

      <section>
        <h2>Avisos</h2>
        <p className="detalle">
          Dos pruebas, y conviene hacerlas en orden: la de <strong>ahora</strong>{' '}
          dice si el teléfono muestra los avisos de la app, y la de{' '}
          <strong>un minuto</strong> dice si además los muestra cuando la app
          está cerrada. Si no llega ninguno de los dos, el problema es otro que
          si llega el primero y no el segundo.
        </p>

        {quePaso === 'no-sono' && (
          <p className="aviso">
            El aviso que programaste sigue anotado en Android y la hora ya pasó:
            la alarma no se disparó. Eso no lo decide la app. Lo frena el ahorro
            de batería del teléfono, que la cierra del todo y se lleva la alarma
            con ella.
          </p>
        )}
        {quePaso === 'se-disparo' && (
          <p className="hecho2">
            El último aviso de prueba sí se disparó: Android ya no lo tiene
            anotado.
          </p>
        )}
        {quePaso === 'esperando' && (
          <p className="detalle">
            Hay un aviso de prueba esperando. Todavía no es la hora.
          </p>
        )}

        <button
          className="secundario"
          onClick={async () => {
            setPrueba(await probarAhora());
            setAnotado(null);
          }}
        >
          Probar ahora
        </button>

        {prueba?.estado === 'mostrado' && (
          <p className="hecho2">
            Mandado. Tendría que aparecer en este momento, sin esperar.
            {' '}Si aparece, probá el de un minuto. Si no aparece, el teléfono no
            está mostrando los avisos de esta app y lo que hay que revisar son
            sus notificaciones en los ajustes del teléfono.
          </p>
        )}

        {prueba?.estado === 'programado' ? (
          <>
            <p className="hecho2">
              Programado para las <strong>{prueba.hora}</strong>. Va a decir
              «{textoDeLaPrueba().titulo}: {textoDeLaPrueba().cuerpo}»
              {anotado === true && ', y el sistema ya lo tiene anotado'}
              {anotado === false && ', pero el sistema no lo tiene anotado'}.
            </p>
            {anotado === false && (
              <p className="aviso">
                Android no lo anotó, así que no va a sonar. Eso no es el ahorro
                de batería: es que la app no pudo programarlo.
              </p>
            )}
            {anotado === true && (
              <p className="detalle">
                Cerrá la app y esperá. Si el de ahora llegó y éste no, lo que lo
                frena es el ahorro de batería del teléfono: buscá Take It Easy
                en los ajustes y ponelo en «sin restricciones», y activale el
                inicio automático.
              </p>
            )}
            <button
              className="terciario"
              onClick={async () => {
                await cancelarLaPrueba();
                setPrueba(null);
                setAnotado(null);
              }}
            >
              Cancelar el aviso de prueba
            </button>
          </>
        ) : (
          <button
            className="secundario"
            onClick={async () => {
              const resultado = await probarElAviso();
              setPrueba(resultado);
              setAnotado(resultado.estado === 'programado' ? await elSistemaLoTiene() : null);
            }}
          >
            Probar en un minuto
          </button>
        )}

        {prueba?.estado === 'sin-permiso' && (
          <p className="aviso">
            Android no dio permiso para avisarte. Se habilita desde los ajustes
            del teléfono, en las notificaciones de Take It Easy.
          </p>
        )}
        {prueba?.estado === 'sin-notificaciones' && (
          <p className="aviso">
            En el navegador no hay avisos. Esto anda en el teléfono.
          </p>
        )}
      </section>

      <section>
        <h2>Instructivo</h2>
        <p className="detalle">
          Volvé a ver la bienvenida y las pistas de cada pantalla, como la
          primera vez.
        </p>
        <button
          className="secundario"
          onClick={async () => {
            await olvidarInstructivo();
            verInstructivo();
          }}
        >
          Ver el instructivo de nuevo
        </button>
      </section>
    </div>
  );
}
