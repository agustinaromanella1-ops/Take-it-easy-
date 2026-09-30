import { useRef, useState } from 'react';
import type { Companero, Periodo, Preferencias, Trato } from '../types';
import { useStore } from '../store/StoreContext';
import { Aviso, Card, Field, Llave, Opciones } from '../components/ui';
import { ListaTrucos } from '../components/Companero';
import { borrarTodo, parseData } from '../lib/storage';
import { descargar, exportarCSV, exportarJSON } from '../lib/exportar';
import { guardarAnimaciones, leerAnimaciones, type Animaciones } from '../lib/movimiento';
import { guardarTema, leerTema, type Tema } from '../lib/tema';
import { buscarVersionNueva } from '../pwa';
import { today } from '../lib/dates';
import { limpiarTodosLosBorradores } from '../lib/borrador';

export function Ajustes({ onVerEjemplo }: { onVerEjemplo: () => void }) {
  const { data, dispatch, esEjemplo } = useStore();
  const p = data.preferencias;
  const cambiar = (cambios: Partial<Omit<Preferencias, 'updatedAt'>>) => dispatch({ type: 'prefs/cambiar', cambios });
  const [tema, setTema] = useState<Tema>(leerTema);
  const [anim, setAnim] = useState<Animaciones>(leerAnimaciones);
  const [aviso, setAviso] = useState('');
  const [version, setVersion] = useState('');
  const [confirmarBorrado, setConfirmarBorrado] = useState('');
  const archivo = useRef<HTMLInputElement>(null);

  return (
    <div className="pagina">
      <h1>Ajustes</h1>

      <Card titulo="Compañero">
        <Opciones<Companero>
          legend="El salchicha"
          valor={p.companero}
          opciones={[
            { valor: 'visible', texto: 'Visible en Hoy' },
            { valor: 'ocasional', texto: 'De vez en cuando' },
            { valor: 'no', texto: 'Sin personaje' },
          ]}
          onChange={(v) => cambiar({ companero: v })}
        />
        <p className="susurro">Sin personaje, la app funciona igual: no se pierde ninguna función.</p>
        <Llave label="Celebraciones" ayuda="La huellita y los trucos. Apagadas, no se ve ninguna animación." checked={p.celebraciones} onChange={(v) => cambiar({ celebraciones: v })} />
        <Llave label="Hormiguita" ayuda="Aparece de vez en cuando a preguntar por gastos chiquitos. Nunca más de una vez cada 3 días." checked={p.hormiga} onChange={(v) => cambiar({ hormiga: v })} />
        <details className="plegable">
          <summary>Trucos aprendidos ({data.huellitas.trucos.length} de 6)</summary>
          <ListaTrucos />
          <p className="susurro">Los trucos no se pierden nunca, aunque pasen meses sin abrir la app.</p>
        </details>
      </Card>

      <Card titulo="Cómo se ve">
        <Opciones<Tema>
          legend="Tema"
          valor={tema}
          opciones={[
            { valor: 'auto', texto: 'Como el teléfono' },
            { valor: 'claro', texto: 'Claro' },
            { valor: 'oscuro', texto: 'Oscuro' },
          ]}
          onChange={(v) => {
            setTema(v);
            guardarTema(v);
          }}
        />
        <Opciones<Animaciones>
          legend="Movimiento"
          valor={anim}
          opciones={[
            { valor: 'auto', texto: 'Como el teléfono' },
            { valor: 'siempre', texto: 'Con movimiento' },
            { valor: 'nunca', texto: 'Sin movimiento' },
          ]}
          onChange={(v) => {
            setAnim(v);
            guardarAnimaciones(v);
          }}
        />
        <Opciones<Trato>
          legend="Cómo te hablo"
          valor={p.trato}
          opciones={[
            { valor: 'neutro', texto: 'Neutro' },
            { valor: 'femenino', texto: 'En femenino' },
            { valor: 'masculino', texto: 'En masculino' },
          ]}
          onChange={(v) => cambiar({ trato: v })}
        />
      </Card>

      <Card titulo="Cálculos">
        <Opciones<Periodo>
          legend="Lo que podés usar, hasta cuándo"
          valor={p.periodo}
          opciones={[
            { valor: 'proximo-ingreso', texto: 'Hasta el próximo cobro' },
            { valor: 'fin-de-mes', texto: 'Hasta fin de mes' },
          ]}
          onChange={(v) => cambiar({ periodo: v })}
        />
        <p className="susurro">Si no hay ningún cobro cargado, se calcula hasta fin de mes.</p>
      </Card>

      <Card titulo="Recordatorios">
        <p>
          La app no manda notificaciones: no hay un servidor que las mande y un navegador cerrado no avisa. Lo que sí funciona con todo cerrado es
          agregar un vencimiento al calendario del teléfono, desde el compromiso ("Al calendario").
        </p>
        <Llave
          label="Mostrar qué y cuánto en el calendario"
          ayuda='Apagado, el evento dice solo "Vence un pago", para que no se lea en la pantalla bloqueada.'
          checked={p.calendarioConDetalle}
          onChange={(v) => cambiar({ calendarioConDetalle: v })}
        />
        <Field label="Recordatorio del calendario">
          <select value={p.recordatorioMin} onChange={(e) => cambiar({ recordatorioMin: Number(e.target.value) })}>
            <option value={0}>El mismo día</option>
            <option value={24 * 60}>Un día antes</option>
            <option value={2 * 24 * 60}>Dos días antes</option>
            <option value={3 * 24 * 60}>Tres días antes</option>
          </select>
        </Field>
      </Card>

      <Card titulo="Tus datos">
        <p>Todo queda en este teléfono: no hay cuentas de usuario, ni servidor, ni analítica. Si se borran los datos del navegador o se pierde el teléfono, se pierden. Por eso conviene bajar una copia cada tanto.</p>
        <div className="acciones">
          <button className="btn principal" onClick={() => descargar(`salchi-copia-${today()}.json`, exportarJSON(data), 'application/json')}>
            Bajar una copia
          </button>
          <button className="btn" onClick={() => descargar(`salchi-movimientos-${today()}.csv`, exportarCSV(data), 'text/csv')}>
            Movimientos para planilla
          </button>
          {!esEjemplo && (
            <button className="btn" onClick={() => archivo.current?.click()}>
              Traer una copia
            </button>
          )}
        </div>
        <input
          ref={archivo}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              const d = parseData(JSON.parse(await f.text()));
              if (!d) return setAviso('Ese archivo no parece una copia de Salchi.');
              limpiarTodosLosBorradores();
              dispatch({ type: 'data/replace', payload: d });
              setAviso('Listo: se trajo la copia. Si fue un error, tocá Deshacer.');
            } catch {
              setAviso('No se pudo leer ese archivo.');
            }
          }}
        />
        {aviso && <Aviso>{aviso}</Aviso>}
        {!esEjemplo && (
          <details className="plegable">
            <summary>Borrar todo</summary>
            <p>Borra todas tus cuentas, movimientos, metas y ajustes de este teléfono. No se puede deshacer.</p>
            <Field label='Para confirmar, escribí "borrar"'>
              <input value={confirmarBorrado} onChange={(e) => setConfirmarBorrado(e.target.value)} autoComplete="off" />
            </Field>
            <button
              className="btn peligro"
              disabled={confirmarBorrado.trim().toLowerCase() !== 'borrar'}
              onClick={() => {
                borrarTodo();
                window.location.reload();
              }}
            >
              Borrar todo
            </button>
          </details>
        )}
      </Card>

      <Card titulo="Probar">
        {esEjemplo ? (
          <p>Estás mirando datos de ejemplo. Para salir, usá la franja de arriba.</p>
        ) : (
          <>
            <p>¿Querés ver cómo se ve con datos? Los de ejemplo no se mezclan con los tuyos ni se guardan.</p>
            <button className="btn" onClick={onVerEjemplo}>
              Ver con datos de ejemplo
            </button>
          </>
        )}
      </Card>

      <Card titulo="Sobre Salchi">
        <p className="susurro">
          Versión del {new Date(__COMPILADA__).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}. Es una herramienta
          de organización, no un tratamiento ni asesoramiento financiero. Está pensada a partir de dificultades frecuentes con el TDAH y todavía
          tiene que probarse con personas reales.
        </p>
        <button
          className="btn chico"
          onClick={async () => {
            const r = await buscarVersionNueva();
            setVersion(r === 'nueva' ? 'Hay una versión nueva: va a aparecer una barra para actualizar.' : r === 'al-dia' ? 'Estás en la última versión.' : 'Este navegador no permite buscar versiones.');
          }}
        >
          Buscar actualización
        </button>
        {version && <p aria-live="polite">{version}</p>}
        <details className="plegable">
          <summary>Qué viene después</summary>
          <ul>
            <li>Más trucos y leer capturas con varios movimientos.</li>
            <li>Resúmenes de tarjeta completos e importar archivos del banco.</li>
            <li>Anotar por voz (opcional: el dictado del navegador manda el audio afuera, y se va a avisar antes).</li>
            <li>Deudas con escenarios, y más adelante inversión educativa.</li>
          </ul>
          <p className="susurro">Nada de esto está disponible todavía.</p>
        </details>
      </Card>
    </div>
  );
}
