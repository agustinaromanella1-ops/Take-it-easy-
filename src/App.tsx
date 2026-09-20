import { Component, useEffect, useRef, useState, type ReactNode } from 'react';
import { StoreProvider } from './store/StoreContext';
import { DashboardPage } from './pages/Dashboard';
import { PatientsPage } from './pages/Patients';
import { PatientDetailPage } from './pages/PatientDetail';
import { AgendaPage } from './pages/Agenda';
import { FinancePage } from './pages/Finance';
import { SettingsPage } from './pages/Settings';
import { IconCalendar, IconChart, IconGear, IconHome, IconPeople } from './components/icons';
import { Welcome, bienvenidaPendiente } from './components/Welcome';
import { Tour, cartelesPendientes } from './components/Tour';
import { Guia } from './components/Guia';
import { Footer } from './components/Footer';
import { Deshacer } from './components/Deshacer';
import { NoSeGuarda } from './components/NoSeGuarda';
import { AvisoDeTurno } from './components/AvisoDeTurno';
import { alHaberVersionNueva } from './pwa';
import { leerTema, seguirAlSistema } from './lib/tema';

type Page = 'inicio' | 'pacientes' | 'agenda' | 'finanzas' | 'ajustes';

const NAV: { id: Page; label: string; short: string; icon: () => ReactNode }[] = [
  { id: 'inicio', label: 'Inicio', short: 'Inicio', icon: IconHome },
  { id: 'pacientes', label: 'Pacientes', short: 'Pacientes', icon: IconPeople },
  { id: 'agenda', label: 'Agenda', short: 'Agenda', icon: IconCalendar },
  { id: 'finanzas', label: 'Finanzas', short: 'Finanzas', icon: IconChart },
  { id: 'ajustes', label: 'Ajustes', short: 'Ajustes', icon: IconGear },
];

/**
 * Un error de render en una pantalla no debe dejar la app en blanco sin
 * explicación: los datos siguen guardados y conviene decirlo.
 */
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="card">
          <h2>Algo falló al mostrar esta pantalla</h2>
          <p className="muted small">
            Tus datos siguen guardados. Probá recargar la página; si el problema sigue, exportá una copia desde
            Ajustes.
          </p>
          <pre className="small muted" style={{ whiteSpace: 'pre-wrap' }}>
            {this.state.error.message}
          </pre>
          <button className="btn primary" onClick={() => window.location.reload()}>
            Recargar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [page, setPage] = useState<Page>('inicio');
  /** La portada saluda en cada arranque. */
  const [bienvenida, setBienvenida] = useState(true);
  /** Si es el primer arranque de todos: ahí espera a que la toquen. */
  const primeraVez = useRef(bienvenidaPendiente());
  /** Los carteles que señalan cada botón: una sola vez, al pasar la portada.
      Se pueden volver a pedir desde la guía. Arrancan siempre desde ahí y no
      al montar: encima de la portada no tendrían a qué apuntar. */
  const [carteles, setCarteles] = useState(false);
  const [guia, setGuia] = useState(false);
  const [openPatientId, setOpenPatientId] = useState<string | null>(null);
  /** El paciente cuyo formulario tiene que abrir la pantalla a la que vamos. */
  const [pedido, setPedido] = useState<string | null>(null);
  /** La función que aplica la versión nueva, cuando hay una esperando. */
  const [aplicarVersion, setAplicarVersion] = useState<(() => void) | null>(null);

  useEffect(() => {
    // El setState guarda una función, así que va envuelta: si no, React la
    // llamaría creyendo que es un actualizador de estado.
    alHaberVersionNueva((aplicar) => setAplicarVersion(() => aplicar));
  }, []);

  /**
   * El permiso de avisos, vigilado.
   *
   * Ajustes guarda el minuto elegido antes de pedir el permiso, así que el
   * componente del aviso se rearmaba con el permiso todavía sin conceder y se
   * quedaba dormido hasta la próxima recarga. Mirando el permiso desde acá,
   * concederlo lo despierta en el acto.
   */
  const [permisoAvisos, setPermisoAvisos] = useState(() =>
    typeof Notification === 'undefined' ? 'sin-soporte' : Notification.permission,
  );
  useEffect(() => {
    if (typeof Notification === 'undefined') return;
    const mirar = () => setPermisoAvisos(Notification.permission);
    let estado: PermissionStatus | null = null;
    navigator.permissions
      ?.query({ name: 'notifications' as PermissionName })
      .then((s) => {
        estado = s;
        s.addEventListener('change', mirar);
      })
      .catch(() => {
        /* Si el navegador no sabe consultar permisos, queda el visibilitychange. */
      });
    document.addEventListener('visibilitychange', mirar);
    return () => {
      estado?.removeEventListener('change', mirar);
      document.removeEventListener('visibilitychange', mirar);
    };
  }, []);

  // Seguir al sistema mientras el tema esté en "automático". Va acá y no en
  // Ajustes porque Ajustes se desmonta al cambiar de pestaña: si el teléfono se
  // oscurecía estando en Agenda, la app se quedaba clara hasta recargar.
  useEffect(() => seguirAlSistema(leerTema), []);

  /**
   * Cambia de pantalla. `paraPaciente` pide, además, que la pantalla destino
   * abra su formulario ya apuntando a esa persona.
   *
   * Existe por la tarjeta de "lo que quedó abierto": decía "Carla tiene
   * $196.000 sin registrar" y el botón dejaba en el resumen de Finanzas, sin
   * formulario y sin mención a Carla. Para terminar había que acordarse de a
   * quién se venía a cobrarle, que es justo lo que la tarjeta hacía por uno.
   */
  function go(next: Page, paraPaciente?: string) {
    setOpenPatientId(null);
    setPage(next);
    setPedido(paraPaciente ?? null);
    window.scrollTo({ top: 0 });
  }

  return (
    <StoreProvider>
      {bienvenida && (
        <Welcome
          primeraVez={primeraVez.current}
          // "Empezar" entra al flujo que ya existe: el inicio guía a cargar el
          // primer paciente cuando todavía no hay ninguno.
          onEmpezar={() => {
            setBienvenida(false);
            go('inicio');
            // Los carteles arrancan recién acá: encima de la bienvenida no
            // tendrían a qué apuntar.
            if (cartelesPendientes()) setCarteles(true);
          }}
        />
      )}
      <div className="app">
        {/* Antes que cualquier otra cosa: si dejó de guardar, hay que saberlo
            ahora y no al cerrar la app. */}
        <NoSeGuarda />

        {aplicarVersion && (
          <div className="update-bar" role="status">
            <span>Hay una versión nueva de la app.</span>
            <button type="button" className="btn small primary" onClick={aplicarVersion}>
              Actualizar
            </button>
          </div>
        )}
        <header className="topbar">
          <span className="brand">
            Pipí <em>Cucú</em>
          </span>
          <nav className="nav">
            {NAV.map((item) => (
              <button
                key={item.id}
                data-tour={item.id}
                onClick={() => go(item.id)}
                aria-current={page === item.id ? 'page' : undefined}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <button
            className="ayuda"
            data-tour="ayuda"
            onClick={() => setGuia(true)}
            aria-label="Guía de uso"
            title="Guía de uso"
          >
            ?
          </button>
        </header>

        <main className="main">
          <ErrorBoundary>
            {page === 'inicio' && <DashboardPage onGo={go} />}
            {page === 'pacientes' &&
              (openPatientId ? (
                <PatientDetailPage patientId={openPatientId} onBack={() => setOpenPatientId(null)} />
              ) : (
                <PatientsPage onOpenPatient={setOpenPatientId} />
              ))}
            {page === 'agenda' && <AgendaPage onGo={go} abrirPara={pedido} onAbierto={() => setPedido(null)} />}
            {page === 'finanzas' && <FinancePage onGo={go} abrirPara={pedido} onAbierto={() => setPedido(null)} />}
            {page === 'ajustes' && <SettingsPage />}
          </ErrorBoundary>
          <Footer />
        </main>

        {/* No dibuja nada: solo avisa cuando se viene un turno. */}
        <AvisoDeTurno permiso={permisoAvisos} />

        {/* Arriba de la barra de pestañas: queda al alcance del pulgar, que es
            donde acaba de tocarse el botón que uno quiere deshacer. */}
        <Deshacer />

        {/* Navegación inferior: en celular es lo que queda al alcance del pulgar. */}
        <nav className="tabbar" aria-label="Secciones">
          {NAV.map((item) => (
            <button
              key={item.id}
              data-tour={item.id}
              onClick={() => go(item.id)}
              aria-current={page === item.id ? 'page' : undefined}
            >
              {item.icon()}
              {item.short}
            </button>
          ))}
        </nav>

        {guia && (
          <Guia
            onClose={() => setGuia(false)}
            onVerCarteles={() => {
              setGuia(false);
              setCarteles(true);
            }}
          />
        )}
        {carteles && <Tour onCerrar={() => setCarteles(false)} />}
      </div>
    </StoreProvider>
  );
}
