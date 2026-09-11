import { useRef, useState } from 'react';

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
