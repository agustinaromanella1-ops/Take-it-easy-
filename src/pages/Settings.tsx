import { useRef, useState } from 'react';
import { useStore } from '../store/StoreContext';
import { parseAppData } from '../lib/storage';
import { today } from '../lib/dates';
import { downloadText } from '../lib/download';
import { cobrosCSV, sesionesCSV } from '../lib/csv';
import { guardarTema, leerTema, type Tema } from '../lib/tema';
import { buscarVersionNueva } from '../pwa';
import { limpiarTodosLosBorradores } from '../lib/borrador';
import { guardarAnimaciones, leerAnimaciones, type Animaciones } from '../lib/movimiento';
import { Card, Field } from '../components/ui';
import { plural } from '../lib/plural';

/**
 * Los datos viven solo en este navegador. Sin exportar/importar, limpiar la
 * caché o cambiar de computadora significa perder todo el historial; por eso la
 * copia de seguridad es parte de la app, no un extra.
 */
export function SettingsPage() {
  const { data, dispatch } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  // Seguir al sistema mientras esté en "automático" lo hace App, que no se
  // desmonta: acá solo se elige.
  const [tema, setTema] = useState<Tema>(leerTema);

  function cambiarTema(nuevo: Tema) {
    setTema(nuevo);
    guardarTema(nuevo);
  }

  const [animaciones, setAnimaciones] = useState<Animaciones>(leerAnimaciones);

  function cambiarAnimaciones(nuevo: Animaciones) {
    setAnimaciones(nuevo);
    guardarAnimaciones(nuevo);
  }

  const [avisoEstado, setAvisoEstado] = useState<string | null>(null);
  const [versionEstado, setVersionEstado] = useState<string | null>(null);

  /**
   * Busca una versión nueva a pedido.
   *
   * El navegador busca solo, pero con la app instalada puede tardar horas en
   * hacerlo. Poder tocar un botón y que conteste algo convierte "no sé si estoy
   * actualizada" en una pregunta con respuesta.
   */
  async function revisarVersion() {
    setVersionEstado('Buscando…');
    const r = await buscarVersionNueva();
    setVersionEstado(
      r === 'nueva'
        ? 'Hay una versión nueva. En unos segundos aparece arriba la barra para actualizar.'
        : r === 'al-dia'
          ? 'Ya tenés la última versión.'
          : 'No se pudo buscar. Probá con internet conectado.',
    );
  }

  /**
   * Prende o apaga el aviso, pidiendo permiso al navegador si hace falta.
   *
   * Se guarda el minuto elegido aunque el permiso se niegue: así el desplegable
   * muestra lo que la persona quiso, y el cartel de abajo explica por qué
   * todavía no suena en vez de dejar la elección sin efecto y sin motivo.
   */
  async function pedirAvisos(minutos: number) {
    dispatch({ type: 'settings/update', payload: { avisarAntesMin: minutos } });
    if (minutos === 0) {
      setAvisoEstado(null);
      return;
    }
    if (typeof Notification === 'undefined') {
      setAvisoEstado('Este navegador no sabe mostrar avisos.');
      return;
    }
    if (Notification.permission === 'granted') {
      setAvisoEstado(null);
      return;
    }
    if (Notification.permission === 'denied') {
      setAvisoEstado('Los avisos están bloqueados para este sitio. Se habilitan desde los permisos del navegador.');
      return;
    }
    const respuesta = await Notification.requestPermission();
    setAvisoEstado(
      respuesta === 'granted' ? null : 'Sin permiso no hay aviso. Podés volver a intentarlo cuando quieras.',
    );
  }

  /** Planillas para abrir en Excel. No reemplazan la copia de seguridad: la
      copia sirve para volver atrás, la planilla para mirar y compartir. */
  function exportarPlanilla(que: 'sesiones' | 'cobros') {
    const hoy = today();
    downloadText(
      `pipi-cucu-${que}-${hoy}.csv`,
      que === 'sesiones' ? sesionesCSV(data) : cobrosCSV(data),
      'text/csv;charset=utf-8',
    );
  }

  function exportData() {
    const total = data.patients.length + data.sessions.length + data.payments.length;

    // Una copia vacía es peor que ninguna: uno la guarda, se queda tranquilo, y
    // se entera de que no tenía nada el día que la necesita. Si no hay qué
    // guardar, se dice y no se descarga.
    if (total === 0) {
      setMessage({
        text: 'Todavía no hay nada para exportar: la copia saldría vacía. Cargá al menos un paciente.',
        ok: false,
      });
      return;
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pipi-cucu-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    // Decir qué se llevó: así se puede comprobar de un vistazo que la copia
    // tiene lo que tenía que tener, sin abrir el archivo.
    setMessage({
      text: `Copia guardada: ${plural(data.patients.length, 'paciente', 'pacientes')}, ${plural(data.sessions.length, 'sesión', 'sesiones')} y ${plural(data.payments.length, 'pago', 'pagos')}.`,
      ok: true,
    });
  }

  async function importData(file: File) {
    try {
      const parsed = parseAppData(JSON.parse(await file.text()));
      const ok = window.confirm(
        `El archivo tiene ${plural(parsed.patients.length, 'paciente', 'pacientes')}, ` +
          `${plural(parsed.sessions.length, 'sesión', 'sesiones')} y ${plural(parsed.payments.length, 'pago', 'pagos')}.` +
          `\n\nEsto REEMPLAZA todos los datos actuales. ¿Continuar?`,
      );
      if (!ok) return;
      dispatch({ type: 'data/replace', payload: parsed });
      // Un borrador a medias del dispositivo anterior, con el nombre de otra
      // persona adentro, no tiene por qué sobrevivir a reemplazar los datos.
      limpiarTodosLosBorradores();
      setMessage({ text: 'Datos importados correctamente.', ok: true });
    } catch {
      setMessage({ text: 'No se pudo leer el archivo. ¿Es una copia de Pipí Cucú?', ok: false });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>Ajustes</h1>
      </div>

      <Card title="Preferencias">
        <div className="field-row">
          <Field label="Símbolo de moneda">
            <input
              value={data.settings.currency}
              maxLength={4}
              onChange={(e) => dispatch({ type: 'settings/update', payload: { currency: e.target.value } })}
            />
          </Field>
          <Field label="Duración por defecto (min)">
            <NumeroAjuste
              valor={data.settings.defaultDurationMin}
              min={5}
              max={480}
              onGuardar={(n) => dispatch({ type: 'settings/update', payload: { defaultDurationMin: n } })}
            />
          </Field>
        </div>
        <div className="field-row">
          <Field label="Alarma del calendario (min antes)">
            <NumeroAjuste
              valor={data.settings.reminderMinutes}
              min={0}
              max={1440}
              onGuardar={(n) => dispatch({ type: 'settings/update', payload: { reminderMinutes: n } })}
            />
          </Field>
        </div>
        {/* El aviso adentro de la app. Va con su explicación pegada porque la
            diferencia con la alarma del calendario no se adivina, y prometer un
            aviso que a veces no llega es peor que no prometerlo. */}
        <Field label="Avisarme antes de cada sesión">
          <select
            value={data.settings.avisarAntesMin}
            onChange={(e) => pedirAvisos(Number(e.target.value))}
          >
            <option value={0}>No avisar</option>
            <option value={5}>5 minutos antes</option>
            <option value={10}>10 minutos antes</option>
            <option value={15}>15 minutos antes</option>
            <option value={30}>30 minutos antes</option>
          </select>
        </Field>
        <p className="small muted" style={{ marginTop: -6 }}>
          Este aviso lo da la app y solo suena si está abierta —aunque sea en otra pestaña—. No es un
          despertador: con la app cerrada no llega. El que sí funciona con todo cerrado es la alarma
          del calendario del teléfono, que se manda con cada turno desde la Agenda.
        </p>
        {/* role="status" para que el resultado llegue a quien no lo ve: es
            justo la explicación de por qué la elección no tuvo efecto. */}
        {avisoEstado && (
          <p className="small muted" role="status">
            {avisoEstado}
          </p>
        )}

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={data.settings.chargeNoShowByDefault}
            onChange={(e) =>
              dispatch({ type: 'settings/update', payload: { chargeNoShowByDefault: e.target.checked } })
            }
            style={{ width: 'auto' }}
          />
          Cobrar las ausencias sin aviso por defecto
        </label>
      </Card>

      <Card title="Copia de seguridad">
        <p className="small muted" style={{ marginTop: 0 }}>
          Tus datos se guardan únicamente en este navegador. Si limpiás la caché, cambiás de computadora o usás el
          modo incógnito, se pierden. Exportá una copia cada tanto y guardala en Drive o en un pendrive.
        </p>
        <p className="small muted">
          La copia es un archivo <code>.json</code>: no se abre en Excel, pero es el único que la app puede volver
          a importar para dejarte todo como estaba. Para mirar los números hay planillas más abajo.
        </p>
        <div className="actions">
          <button className="btn primary" onClick={exportData}>
            Exportar copia (.json)
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            Importar copia
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importData(file);
            }}
          />
        </div>
        {message && (
          <p className={`small ${message.ok ? '' : 'error-text'}`} style={{ marginBottom: 0 }}>
            {message.text}
          </p>
        )}
      </Card>

      <Card title="Datos guardados">
        <p className="small muted" style={{ margin: 0 }}>
          {plural(data.patients.length, 'paciente', 'pacientes')} ·{' '}
          {plural(data.sessions.length, 'sesión', 'sesiones')} ·{' '}
          {plural(data.payments.length, 'pago', 'pagos')}
        </p>
      </Card>

      <Card title="Cómo se ve">
        <p className="small" style={{ marginTop: 0 }}>
          Automático sigue lo que tengas puesto en el teléfono.
        </p>
        <div className="seg" role="group" aria-label="Tema de la app">
          {([
            ['auto', 'Automático'],
            ['claro', '☀ Claro'],
            ['oscuro', '🌙 Oscuro'],
          ] as const).map(([valor, etiqueta]) => (
            <button
              key={valor}
              className={tema === valor ? 'is-on' : ''}
              aria-pressed={tema === valor}
              onClick={() => cambiarTema(valor)}
            >
              {etiqueta}
            </button>
          ))}
        </div>

        <p className="small" style={{ marginBottom: 6, marginTop: 20 }}>Animaciones</p>
        <div className="seg" role="group" aria-label="Animaciones">
          {([
            ['auto', 'Según el sistema'],
            ['siempre', 'Siempre'],
            ['nunca', 'Nunca'],
          ] as const).map(([valor, etiqueta]) => (
            <button
              key={valor}
              className={animaciones === valor ? 'is-on' : ''}
              aria-pressed={animaciones === valor}
              onClick={() => cambiarAnimaciones(valor)}
            >
              {etiqueta}
            </button>
          ))}
        </div>
        <p className="small muted" style={{ marginBottom: 0 }}>
          Si el perrito de la portada está quieto es porque tu equipo tiene las animaciones
          apagadas —el ahorro de batería suele hacerlo solo—. Con “Siempre” vuela igual.
        </p>
      </Card>

      <Card title="Planillas para Excel">
        <p className="small" style={{ marginTop: 0 }}>
          Para hacer tus números, pasarle algo a tu contador o guardar el año cerrado. Se abren en Excel, en Google
          Sheets y en cualquier planilla.
        </p>
        <div className="actions">
          <button className="btn" onClick={() => exportarPlanilla('sesiones')}>
            Sesiones (.csv)
          </button>
          <button className="btn" onClick={() => exportarPlanilla('cobros')}>
            Cobros (.csv)
          </button>
        </div>
        <p className="small muted" style={{ marginBottom: 0 }}>
          Ojo: una planilla no sirve para restaurar la app. Para eso está la copia <code>.json</code> de arriba.
        </p>
      </Card>

      {/* La pregunta "¿y en la computadora?" aparece sola. Conviene responderla
          antes de que aparezca, y explicando el motivo: sin el porqué, esto se
          lee como una función que falta en lugar de una decisión. */}
      <Card title="Por qué no se sincroniza">
        <p className="small" style={{ marginTop: 0 }}>
          Pipí Cucú funciona en un dispositivo por vez, a propósito. Sincronizar obligaría a mandar
          tus pacientes a un servidor y a protegerlos con una contraseña que, si se pierde, nadie
          podría devolverte: si alguien pudiera recuperarla, también podría leerlos.
        </p>
        <p className="small" style={{ marginBottom: 0 }}>
          Entre esas dos cosas, la app elige que tu información no salga de acá y que no dependa de
          que te acuerdes de nada. A cambio, para pasar a otro dispositivo hay que exportar e
          importar —y tené en cuenta que importar reemplaza lo que haya cargado—.
        </p>
      </Card>

      <Card title="Privacidad">
        <p className="small" style={{ marginTop: 0 }}>
          Tus datos no salen de este dispositivo. No hay servidores, ni cuentas, ni terceros.
        </p>
        {/* Página aparte y no una pantalla de la app: Google Play pide una
            dirección pública que se pueda abrir sin instalar nada. */}
        <a className="btn small" href="/privacidad.html" target="_blank" rel="noopener noreferrer">
          Leer la política de privacidad
        </a>
      </Card>

      <Card title="Versión">
        <p className="small muted" style={{ marginTop: 0 }}>
          Esta copia es del {fechaDeCompilacion()}. Las versiones nuevas se buscan solas cada tanto y
          se avisan con una barra arriba de todo; acá podés buscarla ahora.
        </p>
        <button className="btn small" onClick={revisarVersion}>
          Buscar una versión nueva
        </button>
        {versionEstado && (
          <p className="small muted" role="status">
            {versionEstado}
          </p>
        )}
      </Card>

    </>
  );
}

/**
 * Un número de ajuste que se puede escribir.
 *
 * El campo de antes validaba en cada tecla y descartaba lo que no pasara: con
 * 50 puesto, seleccionar todo y escribir "45" dejaba 50, porque el "4" solo
 * quedaba abajo del mínimo y se tiraba. No se podía poner una duración de 45
 * minutos y la app no decía por qué. Ahora lo escrito se ve mientras se
 * escribe, y el valor se guarda al salir del campo o al apretar Enter,
 * acotado al rango. Vacío vuelve a lo que había.
 */
function NumeroAjuste({
  valor,
  min,
  max,
  onGuardar,
}: {
  valor: number;
  min: number;
  max: number;
  onGuardar: (n: number) => void;
}) {
  const [texto, setTexto] = useState(String(valor));
  // Si el valor cambia desde afuera (importar una copia), se refleja.
  const [ultimo, setUltimo] = useState(valor);
  if (valor !== ultimo) {
    setUltimo(valor);
    setTexto(String(valor));
  }

  function confirmar() {
    const n = Number(texto);
    if (texto.trim() === '' || !Number.isFinite(n)) {
      setTexto(String(valor));
      return;
    }
    const acotado = Math.min(max, Math.max(min, Math.round(n)));
    setTexto(String(acotado));
    if (acotado !== valor) onGuardar(acotado);
  }

  return (
    <input
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      step={5}
      value={texto}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={confirmar}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
    />
  );
}

/** "19/9/2026, 21:40" a partir del sello que pone vite.config.ts. */
function fechaDeCompilacion(): string {
  const d = new Date(__COMPILADA__);
  if (Number.isNaN(d.getTime())) return 'fecha desconocida';
  return d.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'medium' });
}
