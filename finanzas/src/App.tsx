import { useCallback, useEffect, useMemo, useState } from 'react';
import { StoreProvider, useStore } from './store/StoreContext';
import { VentanasContext, type Pestana, type Ventana } from './components/Ventanas';
import { Icono } from './components/Icono';
import { Hoy } from './pages/Hoy';
import { MiPlata } from './pages/MiPlata';
import { MisPlanes } from './pages/MisPlanes';
import { Ajustes } from './pages/Ajustes';
import { Bienvenida } from './pages/Bienvenida';
import { Regreso } from './pages/Regreso';
import { Anotar } from './components/formularios/Anotar';
import { AsignarForm, CuentaForm, SaldoForm } from './components/formularios/Cuentas';
import { CobrarForm, CompromisoForm, IngresoForm, PagarForm } from './components/formularios/Compromisos';
import { AporteForm, MetaForm } from './components/formularios/Metas';
import { Comprobante } from './components/Comprobante';
import { Explicacion } from './components/Explicacion';
import { Escenarios } from './components/Escenarios';
import { Importar } from './components/Importar';
import { LeerResumen } from './components/LeerResumen';
import { Inversion } from './components/Inversion';
import { Compartir } from './components/Compartir';
import { Celebracion } from './components/Companero';
import { Hormiga } from './components/Hormiga';
import { BarraActualizar, Deshacer, NoSeGuarda } from './components/Barras';
import { datosDeEjemplo } from './lib/demo';
import { esPausa, guardarVisita, leerUltimaVisita } from './lib/pausa';
import { today } from './lib/dates';

/**
 * Sin router: la navegación es estado, como en Pipí Cucú. Hay tres
 * secciones y un botón de anotar que está siempre en el mismo lugar.
 */
export default function App() {
  const [ejemplo, setEjemplo] = useState(false);
  const datos = useMemo(() => (ejemplo ? datosDeEjemplo() : undefined), [ejemplo]);
  // Una clave distinta por modo: los datos de ejemplo viven en otro store,
  // que no guarda nada, y al salir desaparece entero.
  return (
    <StoreProvider key={ejemplo ? 'ejemplo' : 'real'} {...(datos ? { inicial: datos } : {})}>
      <Cascara ejemplo={ejemplo} onEjemplo={setEjemplo} />
    </StoreProvider>
  );
}

const PESTANAS: { id: Exclude<Pestana, 'ajustes'>; texto: string; icono: string }[] = [
  { id: 'hoy', texto: 'Hoy', icono: 'hoy' },
  { id: 'plata', texto: 'Mi plata', icono: 'plata' },
  { id: 'planes', texto: 'Mis planes', icono: 'planes' },
];

function Cascara({ ejemplo, onEjemplo }: { ejemplo: boolean; onEjemplo: (v: boolean) => void }) {
  const { data } = useStore();
  const [pestana, setPestana] = useState<Pestana>('hoy');
  const [ventana, setVentana] = useState<Ventana | null>(null);
  // La pausa se mide una sola vez, al abrir: después se anota la visita de hoy.
  const [regreso, setRegreso] = useState<string | null>(() => {
    const ultima = leerUltimaVisita();
    return !ejemplo && esPausa(ultima, today()) ? ultima : null;
  });
  useEffect(() => {
    if (!ejemplo) guardarVisita(today());
  }, [ejemplo]);

  const cerrar = useCallback(() => setVentana(null), []);

  /**
   * Atajos del ícono y "compartir" hacia la app: llegan como parámetros en la
   * dirección. Se atienden una vez y se limpian, para que recargar no vuelva a
   * abrir el cuadro.
   */
  const listo = data.preferencias.onboardingHecho;
  useEffect(() => {
    if (!listo || ejemplo) return;
    const q = new URLSearchParams(window.location.search);
    const accion = q.get('accion');
    const texto = [q.get('titulo'), q.get('texto')].filter(Boolean).join(' ').trim();
    if (!accion && !texto) return;
    window.history.replaceState(null, '', '/');
    if (texto) setVentana({ tipo: 'anotar', modo: 'frase', frase: texto.slice(0, 300) });
    else if (accion === 'anotar') setVentana({ tipo: 'anotar' });
    else if (accion === 'foto') setVentana({ tipo: 'comprobante' });
    else if (accion === 'vence') setPestana('plata');
  }, [listo, ejemplo]);
  const irA = useCallback((p: Pestana) => {
    setVentana(null);
    setPestana(p);
    window.scrollTo(0, 0);
  }, []);
  const ctx = useMemo(() => ({ abrir: setVentana, cerrar, irA }), [cerrar, irA]);

  const franja = ejemplo && (
    <div className="franja franja-ejemplo" role="status">
      <span>Estás mirando datos de ejemplo. No se guardan.</span>
      <button className="btn chico" onClick={() => onEjemplo(false)}>
        Salir del ejemplo
      </button>
    </div>
  );

  if (!data.preferencias.onboardingHecho && !ejemplo) {
    return (
      <VentanasContext.Provider value={ctx}>
        <Bienvenida onVerEjemplo={() => onEjemplo(true)} />
      </VentanasContext.Provider>
    );
  }

  return (
    <VentanasContext.Provider value={ctx}>
      <a className="saltar" href="#principal">
        Ir al contenido
      </a>
      {franja}
      <NoSeGuarda />
      <header className="cabecera">
        <span className="marca" aria-hidden="true">
          Salchi
        </span>
        <button className={`btn-icono${pestana === 'ajustes' ? ' activo' : ''}`} onClick={() => irA('ajustes')} aria-current={pestana === 'ajustes' ? 'page' : undefined}>
          <Icono nombre="ajustes" />
          <span>Ajustes</span>
        </button>
      </header>

      <div id="principal" tabIndex={-1}>
        {regreso ? (
          <Regreso desde={regreso} onSalir={() => setRegreso(null)} />
        ) : (
          <>
            {pestana === 'hoy' && <Hoy />}
            {pestana === 'plata' && <MiPlata />}
            {pestana === 'planes' && <MisPlanes />}
            {pestana === 'ajustes' && <Ajustes onVerEjemplo={() => onEjemplo(true)} />}
          </>
        )}
      </div>

      {!regreso && (
        <button className="boton-anotar" onClick={() => setVentana({ tipo: 'anotar' })}>
          <Icono nombre="mas" tam={26} />
          <span>Anotar</span>
        </button>
      )}

      <nav className="navegacion" aria-label="Secciones">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            className={pestana === p.id && !regreso ? 'activo' : undefined}
            aria-current={pestana === p.id && !regreso ? 'page' : undefined}
            onClick={() => {
              setRegreso(null);
              irA(p.id);
            }}
          >
            <Icono nombre={p.icono} />
            <span>{p.texto}</span>
          </button>
        ))}
      </nav>

      <Hormiga enHoy={pestana === 'hoy' && !regreso} ocupada={ventana !== null || regreso !== null} />
      <Celebracion />
      <Deshacer />
      <BarraActualizar />

      {ventana && <VentanaAbierta v={ventana} />}
    </VentanasContext.Provider>
  );
}

function VentanaAbierta({ v }: { v: Ventana }) {
  switch (v.tipo) {
    case 'anotar':
      return (
        <Anotar
          {...(v.mov ? { mov: v.mov } : {})}
          {...(v.modo ? { modo: v.modo } : {})}
          {...(v.fecha ? { fechaInicial: v.fecha } : {})}
          {...(v.frase ? { fraseInicial: v.frase } : {})}
        />
      );
    case 'comprobante':
      return <Comprobante />;
    case 'cuenta':
      return <CuentaForm {...(v.cuenta ? { cuenta: v.cuenta } : {})} {...(v.tipoCuenta ? { tipoInicial: v.tipoCuenta } : {})} />;
    case 'saldo':
      return <SaldoForm cuentaId={v.cuentaId} />;
    case 'asignar':
      return <AsignarForm movimientoId={v.movimientoId} />;
    case 'compromiso':
      return <CompromisoForm {...(v.compromiso ? { compromiso: v.compromiso } : {})} />;
    case 'pagar':
      return <PagarForm vencimiento={v.vencimiento} />;
    case 'ingreso':
      return <IngresoForm {...(v.ingreso ? { ingreso: v.ingreso } : {})} />;
    case 'cobrar':
      return <CobrarForm ingresoId={v.ingresoId} />;
    case 'meta':
      return <MetaForm {...(v.meta ? { meta: v.meta } : {})} esReserva={v.esReserva ?? false} />;
    case 'aporte':
      return <AporteForm metaId={v.metaId} usar={v.usar ?? false} />;
    case 'explicacion':
      return <Explicacion moneda={v.moneda} />;
    case 'escenarios':
      return <Escenarios cuentaId={v.cuentaId} />;
    case 'importar':
      return <Importar />;
    case 'resumen':
      return <LeerResumen tarjetaId={v.tarjetaId} />;
    case 'inversion':
      return <Inversion />;
    case 'compartir':
      return <Compartir />;
  }
}
