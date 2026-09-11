import { useMemo, useState } from 'react';

import { sinDatosDeContacto, type SesionDeAnonimizacion } from './anonimizacion';
import { loResaltado, revisar, sacar, trozos } from './revision';
import './Revision.css';

/**
 * La pantalla de revisión obligatoria.
 *
 * Es el último lugar donde se puede evitar que un nombre de alumno salga del
 * teléfono, así que no se puede desactivar, no tiene "no volver a mostrar" y
 * no se saltea cuando el envío se dispara desde otra pantalla. Lo que se ve
 * acá es, carácter por carácter, lo que se envía.
 */

interface Props {
  sesion: SesionDeAnonimizacion;
  /** Lo que escribió la docente, todavía con nombres. */
  consulta: string;
  enviar: (texto: string) => void;
  volver: () => void;
}

export default function Revision({ sesion, consulta, enviar, volver }: Props) {
  // Anonimizar una vez, al entrar. Volver a hacerlo en cada tecla reescribiría
  // lo que la docente está editando debajo de sus dedos.
  const inicial = useMemo(() => sesion.anonimizar(consulta), [sesion, consulta]);

  const [texto, setTexto] = useState(inicial.texto);
  const [permitidas, setPermitidas] = useState<string[]>([]);
  const [editando, setEditando] = useState(false);

  const estado = revisar(sesion, texto, permitidas);

  // Las que siguen en el texto: si la docente borró un pedazo, listar lo que
  // ya no está sería mentir sobre lo que se envía.
  //
  // Se repite por par, no por alias: dos escuelas comparten "la escuela" y
  // colapsarlas escondería una de las dos. Y se queda la primera de cada par,
  // que es la que vuelve al re-personalizar la respuesta.
  const listadas = new Set<string>();
  const reemplazos = inicial.sustituciones.filter((s) => {
    const par = `${s.original} → ${s.alias}`;
    if (listadas.has(par) || !texto.includes(s.alias)) return false;
    listadas.add(par);
    return true;
  });

  function confirmar() {
    // El botón deshabilitado es una comodidad, no una garantía: el escaneo se
    // vuelve a correr sobre el texto final, justo antes de enviar.
    if (!revisar(sesion, texto, permitidas).sePuedeEnviar) return;
    enviar(texto);
  }

  return (
    <div className="pantalla revision">
      <header>
        <button className="volver" onClick={volver}>
          ← Volver
        </button>
        <h1>Revisá lo que se envía</h1>
        <p className="ayuda">
          Esto es exactamente el texto que sale del teléfono. La IA no ve los
          nombres de tus alumnos: ve lo resaltado.
        </p>
      </header>

      {estado.nombres.length > 0 && (
        <p className="bloqueo">
          Quedó un nombre de alumno en el texto:{' '}
          <strong>{estado.nombres.join(', ')}</strong>. Sacalo para poder enviar.
        </p>
      )}

      {estado.datos.length > 0 && (
        <div className="bloqueo">
          <p>
            Escribiste algo que no sale del teléfono:{' '}
            <strong>{estado.datos.join(', ')}</strong>.
          </p>
          <button onClick={() => setTexto(sinDatosDeContacto(texto))}>Sacarlo</button>
        </div>
      )}

      {editando ? (
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={8}
          autoFocus
        />
      ) : (
        <p className="envio">
          {trozos(texto, loResaltado(inicial.sustituciones)).map((trozo, i) =>
            trozo.resaltado ? (
              <mark key={i}>{trozo.texto}</mark>
            ) : (
              <span key={i}>{trozo.texto}</span>
            ),
          )}
        </p>
      )}

      <button className="terciario" onClick={() => setEditando(!editando)}>
        {editando ? 'Listo, así queda' : 'Editar el texto'}
      </button>

      {estado.sospechas.length > 0 && (
        <section className="sospechas">
          <h2>
            {estado.sospechas.length === 1
              ? 'Una palabra parece un nombre'
              : 'Hay palabras que parecen un nombre'}
          </h2>
          <p className="ayuda">
            La app no las conoce, así que no sabe si son de una persona. Decidí
            vos antes de enviar.
          </p>
          <ul>
            {estado.sospechas.map((palabra) => (
              <li key={palabra}>
                <span className="palabra">{palabra}</span>
                <div className="decidir">
                  <button onClick={() => setTexto(sacar(texto, palabra))}>Sacarla</button>
                  <button
                    className="dejar"
                    onClick={() => setPermitidas((p) => [...p, palabra])}
                  >
                    No es un nombre
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(reemplazos.length > 0 || inicial.datosQuitados.length > 0) && (
        <section className="reemplazos">
          <h2>Lo que se reemplazó</h2>
          <ul>
            {reemplazos.map((s) => (
              <li key={`${s.original} → ${s.alias}`}>
                <span className="antes">{s.original}</span>
                <span className="flecha">→</span>
                <span className="despues">{s.alias}</span>
              </li>
            ))}
            {inicial.datosQuitados.length > 0 && (
              <li className="quitados">
                También se sacaron: {inicial.datosQuitados.join(', ')}.
              </li>
            )}
          </ul>
        </section>
      )}

      <div className="pie">
        <button className="primario" onClick={confirmar} disabled={!estado.sePuedeEnviar}>
          Enviar
        </button>
        <button className="secundario" onClick={volver}>
          Volver
        </button>
      </div>
    </div>
  );
}
