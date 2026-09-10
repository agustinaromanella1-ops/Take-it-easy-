import { useState } from 'react';

import { estanCompletas, parsearLista, type FilaParseada } from '../alumnos/parseo';
import { altaMasiva, deshacerAlta, type ResultadoAlta } from '../datos/alumnos';
import { inscribir } from '../datos/inscripciones';
import type { Id } from '../datos/tipos';
import { hoy } from '../fecha';
import './CargarAlumnos.css';

type Paso = 'pegar' | 'revisar' | 'listo';

interface Props {
  materiaId: Id;
  volver: () => void;
}

export default function CargarAlumnos({ materiaId, volver }: Props) {
  const [paso, setPaso] = useState<Paso>('pegar');
  const [texto, setTexto] = useState('');
  const [filas, setFilas] = useState<FilaParseada[]>([]);
  const [resultado, setResultado] = useState<ResultadoAlta | null>(null);

  function revisar() {
    setFilas(parsearLista(texto));
    setPaso('revisar');
  }

  function corregir(indice: number, campo: 'apellido' | 'nombre', valor: string) {
    setFilas((previas) =>
      previas.map((fila, i) =>
        // Editada es revisada: la marca deja de tener sentido.
        i === indice ? { ...fila, [campo]: valor, confianza: 'alta', motivo: undefined } : fila,
      ),
    );
  }

  function quitar(indice: number) {
    setFilas((previas) => previas.filter((_, i) => i !== indice));
  }

  async function agregar() {
    const alta = await altaMasiva(filas.map(({ apellido, nombre }) => ({ apellido, nombre })));

    // Los repetidos también se inscriben: ya existían de otra materia, y el
    // alumno es uno solo aunque lo tengas en varias.
    await inscribir(materiaId, [...alta.creados, ...alta.repetidos.map((a) => a.id)], hoy());

    setResultado(alta);
    setPaso('listo');
  }

  async function deshacer() {
    if (resultado) await deshacerAlta(resultado.creados);
    volverAEmpezar();
  }

  function volverAEmpezar() {
    setTexto('');
    setFilas([]);
    setResultado(null);
    setPaso('pegar');
  }

  if (paso === 'pegar') {
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
          onChange={(e) => setTexto(e.target.value)}
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

  if (paso === 'revisar') {
    const paraRevisar = filas.filter((f) => f.confianza === 'revisar').length;
    const descartados = filas.flatMap((f) => f.descartado);

    return (
      <div className="pantalla alumnos">
        <header>
          <button className="volver" onClick={() => setPaso('pegar')}>
            ← Volver al texto
          </button>
          <h1>Revisá la lista</h1>
          <p className="resumen">
            {filas.length} {filas.length === 1 ? 'alumno reconocido' : 'alumnos reconocidos'}
            {paraRevisar > 0 && <span className="pendiente">, {paraRevisar} para revisar</span>}
          </p>
        </header>

        {descartados.length > 0 && (
          <p className="descartado">
            La app no guarda documentos, teléfonos ni correos, así que se dejaron
            afuera: {descartados.join(', ')}.
          </p>
        )}

        <ul className="filas">
          {filas.map((fila, i) => (
            <li key={i} className={fila.confianza === 'revisar' ? 'fila revisar' : 'fila'}>
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
            disabled={filas.length === 0 || !estanCompletas(filas)}
          >
            Agregar {filas.length} {filas.length === 1 ? 'alumno' : 'alumnos'}
          </button>
          {!estanCompletas(filas) && (
            <p className="aviso">Hay filas sin apellido o sin nombre. Completalas o quitalas.</p>
          )}
        </div>
      </div>
    );
  }

  const creados = resultado?.creados.length ?? 0;
  const repetidos = resultado?.repetidos.length ?? 0;

  return (
    <div className="pantalla alumnos">
      <header>
        <h1>Listo</h1>
        <p className="resumen">
          {creados === 0
            ? 'No se agregó nadie nuevo.'
            : `Se agregaron ${creados} ${creados === 1 ? 'alumno' : 'alumnos'}.`}
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
        <button className="primario" onClick={volver}>
          Volver a la materia
        </button>
        <button className="secundario" onClick={volverAEmpezar}>
          Pegar otra lista
        </button>
        {creados > 0 && (
          <button className="secundario" onClick={deshacer}>
            Deshacer
          </button>
        )}
      </div>
    </div>
  );
}
