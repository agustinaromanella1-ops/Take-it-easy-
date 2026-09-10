import { useState } from 'react';

import {
  estanCompletas,
  parsearLista,
  sinDatosQueNoSeGuardan,
  type FilaParseada,
} from '../alumnos/parseo';
import {
  agregarAlumnosAMateria,
  deshacerAltaEnMateria,
  type AltaEnMateria,
} from '../datos/altaEnMateria';
import type { Id } from '../datos/tipos';
import { hoy } from '../fecha';
import { useBorrador } from '../hooks/useBorrador';
import './CargarAlumnos.css';

/**
 * Lo que se guarda no lleva los datos descartados: el borrador dejaría el DNI
 * escrito en la base justo debajo del cartel que dice que no se guarda.
 */
type FilaGuardada = Omit<FilaParseada, 'descartado'>;

function sinDatosDescartados(fila: FilaParseada): FilaGuardada {
  const { linea, apellido, nombre, confianza, motivo } = fila;
  return { linea, apellido, nombre, confianza, motivo };
}

interface Borrador {
  paso: 'pegar' | 'revisar';
  /** Ya sin documentos ni correos: es lo único que llega a la base. */
  textoSeguro: string;
  filas: FilaGuardada[];
  descartados: number;
}

const VACIO: Borrador = { paso: 'pegar', textoSeguro: '', filas: [], descartados: 0 };

interface Props {
  materiaId: Id;
  volver: () => void;
}

export default function CargarAlumnos({ materiaId, volver }: Props) {
  const { valor, setValor, limpiar, listo } = useBorrador<Borrador>(
    `alumnos:${materiaId}`,
    VACIO,
  );
  const [resultado, setResultado] = useState<AltaEnMateria | null>(null);
  const [guardando, setGuardando] = useState(false);
  // Los valores descartados se muestran, pero no sobreviven a la pantalla.
  const [descartados, setDescartados] = useState<string[]>([]);
  const [listaUsada, setListaUsada] = useState<Borrador | null>(null);
  // Lo que se ve en el cuadro de texto es lo que pegó, con documentos y todo.
  // Sólo vive en memoria: a la base va la versión sin esos datos. Mientras no
  // escribió nada, se muestra lo que volvió del borrador.
  const [textoEscrito, setTextoEscrito] = useState<string | null>(null);
  const texto = textoEscrito ?? valor.textoSeguro;

  function escribir(nuevo: string) {
    setTextoEscrito(nuevo);
    setValor((previo) => ({ ...previo, textoSeguro: sinDatosQueNoSeGuardan(nuevo) }));
  }

  function revisar() {
    const filas = parsearLista(texto);
    setDescartados(filas.flatMap((f) => f.descartado));
    setValor((previo) => ({
      ...previo,
      paso: 'revisar',
      filas: filas.map(sinDatosDescartados),
      descartados: filas.reduce((total, f) => total + f.descartado.length, 0),
    }));
  }

  function corregir(indice: number, campo: 'apellido' | 'nombre', texto: string) {
    setValor((previo) => ({
      ...previo,
      filas: previo.filas.map((fila, i) =>
        // Editada es revisada: la marca deja de tener sentido.
        i === indice ? { ...fila, [campo]: texto, confianza: 'alta', motivo: undefined } : fila,
      ),
    }));
  }

  function quitar(indice: number) {
    setValor((previo) => ({ ...previo, filas: previo.filas.filter((_, i) => i !== indice) }));
  }

  async function agregar() {
    // Sin esta guarda, el segundo toque pisa el resultado del primero con uno
    // vacío: la pantalla diría que no se agregó nadie y escondería el deshacer.
    if (guardando) return;
    setGuardando(true);
    try {
      const alta = await agregarAlumnosAMateria(
        materiaId,
        valor.filas.map(({ apellido, nombre }) => ({ apellido, nombre })),
        hoy(),
      );

      setListaUsada(valor);
      setResultado(alta);
      limpiar();
    } finally {
      setGuardando(false);
    }
  }

  async function deshacer() {
    if (!resultado) return;
    await deshacerAltaEnMateria(materiaId, resultado, hoy());
    // Vuelve la lista con las correcciones hechas a mano: deshacer no puede
    // costar rehacer todo el trabajo de revisión.
    if (listaUsada) setValor(listaUsada);
    setTextoEscrito(null);
    setResultado(null);
    setListaUsada(null);
  }

  function salir() {
    limpiar();
    setTextoEscrito(null);
    volver();
  }

  if (resultado) {
    const creados = resultado.creados.length;
    const repetidos = resultado.repetidos.length;

    return (
      <div className="pantalla alumnos">
        <header>
          <h1>Listo</h1>
          <p className="resumen">
            {creados === 0 && 'No se agregó nadie nuevo.'}
            {creados === 1 && 'Se agregó 1 alumno.'}
            {creados > 1 && `Se agregaron ${creados} alumnos.`}
          </p>
          {repetidos > 0 && (
            <p className="ayuda">
              {repetidos === 1 ? 'Uno ya estaba' : `${repetidos} ya estaban`} cargado
              {repetidos === 1 ? '' : 's'} de otra materia, así que se
              {repetidos === 1 ? ' inscribió' : ' inscribieron'} en esta sin duplicarse:
              un alumno existe una sola vez.
            </p>
          )}
        </header>

        <div className="pie">
          <button className="primario" onClick={salir}>
            Volver a la materia
          </button>
          {(creados > 0 || resultado.inscripcion.nuevas.length > 0) && (
            <button className="secundario" onClick={deshacer}>
              Deshacer
            </button>
          )}
        </div>
      </div>
    );
  }

  if (valor.paso === 'pegar') {
    return (
      <div className="pantalla alumnos">
        <header>
          <button className="volver" onClick={volver}>
            ← Volver a la materia
          </button>
          <h1>Pegar la lista</h1>
          <p className="ayuda">
            Copiá la lista de tu planilla y pegala acá. Después vas a poder revisar
            lo que se entendió, antes de agregar a nadie.
          </p>
        </header>

        <textarea
          value={texto}
          onChange={(e) => escribir(e.target.value)}
          placeholder={'1. ACUÑA, Malena\n2. BARRETO, Ignacio'}
          rows={12}
        />

        <div className="pie">
          <button className="primario" onClick={revisar} disabled={texto.trim() === ''}>
            Revisar la lista
          </button>
        </div>
      </div>
    );
  }

  const { filas } = valor;
  const paraRevisar = filas.filter((f) => f.confianza === 'revisar').length;
  const completas = estanCompletas(filas);

  return (
    <div className="pantalla alumnos">
      <header>
        <button
          className="volver"
          onClick={() => setValor((previo) => ({ ...previo, paso: 'pegar' }))}
        >
          ← Volver al texto
        </button>
        <h1>Revisá la lista</h1>
        <p className="resumen">
          {filas.length} {filas.length === 1 ? 'alumno reconocido' : 'alumnos reconocidos'}
          {paraRevisar > 0 && <span className="pendiente">, {paraRevisar} para revisar</span>}
        </p>
      </header>

      {(descartados.length > 0 || valor.descartados > 0) && (
        <p className="descartado">
          La app no guarda documentos, teléfonos ni correos, así que se
          {descartados.length > 0
            ? ` dejaron afuera: ${descartados.join(', ')}.`
            : ` dejaron afuera ${valor.descartados} ${
                valor.descartados === 1 ? 'dato' : 'datos'
              } de la lista.`}
        </p>
      )}

      <ul className="filas">
        {filas.map((fila, i) => (
          <li key={i} className={fila.confianza === 'revisar' ? 'fila revisar' : 'fila'}>
            <div className="encabezado">
              <span className="num">{i + 1}</span>
              {fila.confianza === 'revisar' && <span className="marca">Revisar</span>}
            </div>
            <div className="campos">
              <label>
                <span>Apellido</span>
                <input
                  value={fila.apellido}
                  onChange={(e) => corregir(i, 'apellido', e.target.value)}
                />
              </label>
              <label>
                <span>Nombre</span>
                <input
                  value={fila.nombre}
                  onChange={(e) => corregir(i, 'nombre', e.target.value)}
                />
              </label>
            </div>
            {fila.motivo && <p className="motivo">{fila.motivo}</p>}
            <div className="original">
              <span>{fila.linea}</span>
              <button onClick={() => quitar(i)}>Quitar</button>
            </div>
          </li>
        ))}
      </ul>

      <div className="pie">
        <button
          className="primario"
          onClick={agregar}
          disabled={filas.length === 0 || !completas || !listo || guardando}
        >
          Agregar {filas.length} {filas.length === 1 ? 'alumno' : 'alumnos'}
        </button>
        {!completas && (
          <p className="aviso">Hay filas sin apellido o sin nombre. Completalas o quitalas.</p>
        )}
      </div>
    </div>
  );
}
