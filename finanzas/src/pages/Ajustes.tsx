import { useRef, useState } from 'react';
import type { Companero, Periodo, Preferencias, Trato } from '../types';
import { useStore } from '../store/StoreContext';
import { useVentanas } from '../components/Ventanas';
import { Aviso, Card, Field, Llave, Opciones } from '../components/ui';
import { ListaTrucos } from '../components/Companero';
import { TRUCOS } from '../lib/huellitas/huellitas';
import { borrarTodo, parseData } from '../lib/storage';
import { descargar, exportarCSV, exportarJSON, recordatorioICS, vencimientosICS } from '../lib/exportar';
import { vencimientos } from '../lib/finanzas/pendientes';
import { guardarAnimaciones, leerAnimaciones, type Animaciones } from '../lib/movimiento';
import { guardarTema, leerTema, type Tema } from '../lib/tema';
import { buscarVersionNueva } from '../pwa';
import { hayVoz } from '../lib/voz';
import { today } from '../lib/dates';
import { limpiarTodosLosBorradores } from '../lib/borrador';

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export function Ajustes({ onVerEjemplo }: { onVerEjemplo: () => void }) {
  const { data, dispatch, esEjemplo } = useStore();
  const { abrir } = useVentanas();
  const p = data.preferencias;
  const cambiar = (cambios: Partial<Omit<Preferencias, 'updatedAt'>>) => dispatch({ type: 'prefs/cambiar', cambios });
  const [tema, setTema] = useState<Tema>(leerTema);
  const [anim, setAnim] = useState<Animaciones>(leerAnimaciones);
  const [aviso, setAviso] = useState('');
  const [diaRevision, setDiaRevision] = useState(0);
  const [horaRevision, setHoraRevision] = useState('19:00');
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
          <summary>Trucos aprendidos ({data.huellitas.trucos.length} de {TRUCOS.length})</summary>
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

      <Card titulo="Dictar por voz">
        <p>
          Sirve para anotar hablando: "gasté ocho mil en la verdulería". El que pasa la voz a texto es el navegador, y en Chrome eso manda el audio
          a los servidores de Google. Es lo único de la app que sale del teléfono, por eso viene apagado.
        </p>
        {hayVoz() ? (
          <Llave label="Dictar por voz" ayuda="Aparece un botón “Dictar” al anotar con una frase." checked={p.voz} onChange={(v) => cambiar({ voz: v })} />
        ) : (
          <p className="susurro">Este navegador no permite dictar. Se puede escribir la frase igual.</p>
        )}
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
          agregar los vencimientos al calendario del teléfono: de a uno desde cada compromiso, o todos juntos acá.
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
        <button
          className="btn"
          disabled={vencimientos(data).length === 0}
          onClick={() =>
            descargar(
              `salchi-vencimientos-${today()}.ics`,
              vencimientosICS(
                vencimientos(data).map((v) => ({
                  clave: v.clave,
                  nombre: v.nombre,
                  importe: v.importe,
                  moneda: v.moneda,
                  fecha: v.fecha,
                  recurrente: v.tipo === 'compromiso' && data.compromisos.find((k) => k.id === v.id)?.recurrencia === 'mensual',
                })),
                p,
              ),
              'text/calendar',
            )
          }
        >
          Todos los vencimientos al calendario
        </button>

        <h3>Un rato para mirar la plata</h3>
        <p className="susurro">
          Un recordatorio que se repite, el día y la hora que elijas. No dice nada de plata, solo "Mirar Salchi". Si lo ignorás, no insiste más.
        </p>
        <div className="fila">
          <Field label="Día">
            <select value={diaRevision} onChange={(e) => setDiaRevision(Number(e.target.value))}>
              <option value={-1}>Todos los días</option>
              {DIAS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Hora">
            <input type="time" value={horaRevision} onChange={(e) => setHoraRevision(e.target.value || '19:00')} />
          </Field>
        </div>
        <button
          className="btn"
          onClick={() =>
            descargar(
              'salchi-recordatorio.ics',
              recordatorioICS({
                titulo: 'Mirar Salchi',
                frecuencia: diaRevision === -1 ? 'DAILY' : 'WEEKLY',
                dia: Math.max(0, diaRevision),
                hora: horaRevision,
                desde: today(),
                uid: `revision-${diaRevision}-${horaRevision.replace(':', '')}`,
              }),
              'text/calendar',
            )
          }
        >
          Agregar al calendario
        </button>
      </Card>

      <Card titulo="Tus datos">
        <p>Todo queda en este teléfono: no hay cuentas de usuario, ni servidor, ni analítica{p.voz ? ' (salvo el audio del dictado, si lo prendiste)' : ''}. Si se borran los datos del navegador o se pierde el teléfono, se pierden. Por eso conviene bajar una copia cada tanto.</p>
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
          <button className="btn" onClick={() => abrir({ tipo: 'importar' })}>
            Importar movimientos del banco (CSV)
          </button>
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
            <li>Compartir con una persona que elijas, con permisos que se pueden sacar.</li>
            <li>Planificación y un espacio educativo sobre inversión, con simulaciones que muestran también pérdidas.</li>
            <li>Conectar bancos, solo si se puede verificar que es seguro.</li>
          </ul>
          <p className="susurro">Nada de esto está disponible todavía.</p>
        </details>
      </Card>
    </div>
  );
}
