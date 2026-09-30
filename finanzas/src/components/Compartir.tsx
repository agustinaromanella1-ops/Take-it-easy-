import { useEffect, useState } from 'react';
import { useStore } from '../store/StoreContext';
import { useVentanas } from './Ventanas';
import { Aviso, Field, Llave, Modal } from './ui';
import { cifrar, nuevaClave } from '../lib/compartir/cripto';
import { NOMBRE_PERMISO, PERMISOS_INICIALES, armarVista, type Permisos } from '../lib/compartir/vista';
import {
  actualizar,
  crear,
  enlace,
  estadoDelServicio,
  guardarCompartidos,
  leerCompartidos,
  revocar,
  type Compartido,
  type Estado,
} from '../lib/compartir/cliente';
import { formatDateMedium, today } from '../lib/dates';

/**
 * Compartir con una persona de confianza: solo lo que elijas, de solo
 * lectura, y se puede cortar cuando quieras.
 *
 * Lo que se manda está cifrado en el teléfono; la clave va en el enlace y el
 * servidor no la ve. Por eso el enlace es lo único que hay que cuidar: quien
 * lo tenga, ve lo compartido.
 */
export function Compartir() {
  const { data, esEjemplo } = useStore();
  const { cerrar } = useVentanas();
  const [estado, setEstado] = useState<Estado | 'buscando'>('buscando');
  const [lista, setLista] = useState<Compartido[]>(leerCompartidos);
  const [persona, setPersona] = useState('');
  const [permisos, setPermisos] = useState<Permisos>(PERMISOS_INICIALES);
  const [trabajando, setTrabajando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [nuevo, setNuevo] = useState<string | null>(null);

  useEffect(() => {
    void estadoDelServicio().then(setEstado);
  }, []);

  const origen = window.location.origin;
  const guardar = (l: Compartido[]) => {
    setLista(l);
    guardarCompartidos(l);
  };
  const vista = (p: Permisos) => armarVista(data, p, today(), new Date().toISOString());

  async function crearEnlace() {
    if (!Object.values(permisos).some(Boolean)) return setAviso('Elegí al menos una cosa para compartir.');
    setTrabajando(true);
    setAviso('');
    try {
      const clave = nuevaClave();
      const { id, token } = await crear(await cifrar(vista(permisos), clave));
      const ahora = new Date().toISOString();
      const c: Compartido = { id, token, clave, persona: persona.trim() || 'Alguien de confianza', permisos, creadoEn: ahora, actualizadoEn: ahora };
      guardar([...lista, c]);
      setNuevo(enlace(c, origen));
      setPersona('');
    } catch {
      setAviso('No se pudo crear el enlace. No se compartió nada.');
    } finally {
      setTrabajando(false);
    }
  }

  async function ponerAlDia(c: Compartido) {
    setTrabajando(true);
    try {
      const ok = await actualizar(c.id, c.token, await cifrar(vista(c.permisos), c.clave));
      if (!ok) {
        guardar(lista.filter((x) => x.id !== c.id));
        setAviso(`El enlace de ${c.persona} ya había vencido. Si querés, creá uno nuevo.`);
      } else {
        guardar(lista.map((x) => (x.id === c.id ? { ...x, actualizadoEn: new Date().toISOString() } : x)));
        setAviso(`Listo: ${c.persona} ve lo de hoy.`);
      }
    } catch {
      setAviso('No se pudo actualizar. Lo que ve es lo de la última vez.');
    } finally {
      setTrabajando(false);
    }
  }

  async function dejarDeCompartir(c: Compartido) {
    setTrabajando(true);
    try {
      await revocar(c.id, c.token);
      guardar(lista.filter((x) => x.id !== c.id));
      setAviso(`Listo: el enlace de ${c.persona} ya no funciona.`);
    } catch {
      setAviso('No se pudo cortar ahora. Probá de nuevo con conexión.');
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <Modal titulo="Compartir con alguien de confianza" onClose={cerrar}>
      <p>
        Para que una persona que elijas pueda mirar, sin tocar, lo que decidas: por ejemplo, lo que vence. Lo que se manda va cifrado desde tu
        teléfono; el servidor guarda algo que no puede leer.
      </p>

      {esEjemplo && <Aviso>Con datos de ejemplo no se puede compartir.</Aviso>}

      {estado === 'buscando' && <p aria-live="polite">Buscando el servicio…</p>}
      {estado === 'sin-configurar' && (
        <Aviso tono="warn">
          El servicio para compartir no está configurado en este servidor. Todo lo demás de la app funciona igual. (Para quien lo instala: ver
          COMPARTIR.md.)
        </Aviso>
      )}
      {estado === 'sin-conexion' && <Aviso tono="warn">Sin conexión. Para compartir hace falta internet; para todo lo demás, no.</Aviso>}

      {estado === 'disponible' && !esEjemplo && (
        <>
          {lista.length > 0 && (
            <>
              <h3>Lo que estás compartiendo</h3>
              <ul className="lista">
                {lista.map((c) => (
                  <li key={c.id} className="lista-item">
                    <div className="lista-principal">
                      <span className="lista-nombre">{c.persona}</span>
                      <span className="susurro">
                        {(Object.keys(c.permisos) as (keyof Permisos)[])
                          .filter((k) => c.permisos[k])
                          .map((k) => NOMBRE_PERMISO[k].toLowerCase())
                          .join(', ')}
                        . Actualizado el {formatDateMedium(c.actualizadoEn.slice(0, 10))}.
                      </span>
                      <span className="enlace-compartido">{enlace(c, origen)}</span>
                    </div>
                    <div className="acciones">
                      <button type="button" className="btn chico" onClick={() => void navigator.clipboard?.writeText(enlace(c, origen)).then(() => setAviso('Enlace copiado.'))}>
                        Copiar enlace
                      </button>
                      <button type="button" className="btn chico" disabled={trabajando} onClick={() => void ponerAlDia(c)}>
                        Mostrarle lo de hoy
                      </button>
                      <button type="button" className="btn chico peligro" disabled={trabajando} onClick={() => void dejarDeCompartir(c)}>
                        Dejar de compartir
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}

          <h3>Compartir con alguien más</h3>
          <Field label="Con quién (solo para vos)" ayuda="No se manda: sirve para acordarte de quién es cada enlace.">
            <input value={persona} onChange={(e) => setPersona(e.target.value)} autoComplete="off" placeholder="Por ejemplo: mi hermana" />
          </Field>
          <fieldset className="opciones">
            <legend className="field-label">Qué puede ver</legend>
            {(Object.keys(NOMBRE_PERMISO) as (keyof Permisos)[]).map((k) => (
              <Llave key={k} label={NOMBRE_PERMISO[k]} checked={permisos[k]} onChange={(v) => setPermisos((p) => ({ ...p, [k]: v }))} />
            ))}
          </fieldset>
          <p className="susurro">
            Ve lo de este momento. Cuando quieras que vea lo nuevo, tocás "Mostrarle lo de hoy". Nunca ve tus notas, ni puede cambiar nada. El
            enlace vence solo a los 30 días.
          </p>
          <button type="button" className="btn principal grande" disabled={trabajando} onClick={() => void crearEnlace()}>
            Crear enlace
          </button>
          {nuevo && (
            <div className="aviso aviso-ok" role="status">
              <p>
                <strong>Enlace listo.</strong> Mandáselo por donde quieras. Quien tenga este enlace ve lo compartido:
              </p>
              <p className="enlace-compartido" data-testid="enlace-nuevo">
                {nuevo}
              </p>
              <button type="button" className="btn chico" onClick={() => void navigator.clipboard?.writeText(nuevo).then(() => setAviso('Enlace copiado.'))}>
                Copiar
              </button>
            </div>
          )}
          <p className="susurro">
            Dejar de compartir borra lo guardado en el servidor y el enlace deja de andar. Lo que la otra persona ya vio, no se puede des-ver.
          </p>
        </>
      )}
      {aviso && (
        <p aria-live="polite" className="entendido">
          {aviso}
        </p>
      )}
    </Modal>
  );
}
