import { Component, useState, type ReactNode } from 'react';
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
  /** La bienvenida se muestra una sola vez, la primera que se abre la app. */
  const [bienvenida, setBienvenida] = useState(bienvenidaPendiente);
  /** Los carteles que señalan cada botón: también una sola vez, después de la
      bienvenida. Se pueden volver a pedir desde la guía. */
  const [carteles, setCarteles] = useState(() => !bienvenidaPendiente() && cartelesPendientes());
  const [guia, setGuia] = useState(false);
  const [openPatientId, setOpenPatientId] = useState<string | null>(null);

  function go(next: Page) {
    setOpenPatientId(null);
    setPage(next);
    window.scrollTo({ top: 0 });
  }

  return (
    <StoreProvider>
      {bienvenida && (
        <Welcome
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
            {page === 'agenda' && <AgendaPage />}
            {page === 'finanzas' && <FinancePage />}
            {page === 'ajustes' && <SettingsPage />}
          </ErrorBoundary>
        </main>

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
