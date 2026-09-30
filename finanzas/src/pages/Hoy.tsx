import type { Moneda } from '../types';
import { useStore } from '../store/StoreContext';
import { useVentanas } from '../components/Ventanas';
import { Card, Llave, Progreso } from '../components/ui';
import { TarjetaCompanero } from '../components/Companero';
import { calcularDisponible, monedasEnUso, textoFaltante, type Disponible } from '../lib/finanzas/disponible';
import { pasoSugerido, proximoVencimiento, vencimientos } from '../lib/finanzas/pendientes';
import { mesesCubiertos, reservado } from '../lib/finanzas/metas';
import { formatMoney } from '../lib/money';
import { capitalizar, daysBetween, distancia, formatDateLong, formatDateMedium, today } from '../lib/dates';
import { mensaje } from '../lib/companero';

/**
 * Hoy responde tres preguntas, en este orden: cuánto puedo usar, qué vence y
 * cuál es el próximo paso chiquito. Nada más arriba.
 */
export function Hoy() {
  const { data, dispatch } = useStore();
  const hoy = today();
  const p = data.preferencias;
  const monedas = monedasEnUso(data);
  const disponibles = monedas.map((m) => calcularDisponible(data, m, hoy));
  const ars = disponibles[0];
  const otros = disponibles.slice(1);

  const deficit = disponibles.some((d) => d.importe !== null && d.importe < 0);
  const pendientes = vencimientos(data).filter((v) => daysBetween(hoy, v.fecha) <= 7).length;
  const textoPerro =
    data.cuentas.length === 0
      ? mensaje('sin-datos', p.trato)
      : deficit
        ? mensaje('deficit', p.trato)
        : pendientes > 1
          ? mensaje('varios-pendientes', p.trato)
          : mensaje('saludo', p.trato);

  return (
    <div className="pagina">
      <h1 className="fecha-hoy">{capitalizar(formatDateLong(hoy))}</h1>

      {ars && <TarjetaDisponible d={ars} />}
      {otros.map((d) => (
        <TarjetaDisponible key={d.moneda} d={d} chica />
      ))}

      <ProximoCompromiso />

      {!p.bajaEnergia && <PasoChico />}
      {!p.bajaEnergia && <MetaDestacada />}
      {!p.bajaEnergia && p.companero === 'visible' && <TarjetaCompanero texto={textoPerro} />}

      <div className="baja-energia">
        <Llave
          label="Modo baja energía"
          ayuda="Deja solo lo que podés usar, lo próximo que vence y el botón de anotar."
          checked={p.bajaEnergia}
          onChange={(v) => dispatch({ type: 'prefs/cambiar', cambios: { bajaEnergia: v } })}
        />
      </div>
    </div>
  );
}

function TarjetaDisponible({ d, chica = false }: { d: Disponible; chica?: boolean }) {
  const { abrir, irA } = useVentanas();
  const hoy = today();
  const moneda: Moneda = d.moneda;
  const titulo = `${moneda === 'USD' ? 'En dólares, podés' : 'Podés'} usar hasta el ${formatDateMedium(d.hasta)}`;

  if (d.importe === null) {
    return (
      <Card className="disponible">
        <h2 className="disponible-titulo">{titulo}</h2>
        <p className="disponible-falta">{textoFaltante({ tipo: 'sin-cuentas' })}</p>
        <button className="btn principal" onClick={() => abrir({ tipo: 'cuenta' })}>
          Cargar una cuenta
        </button>
      </Card>
    );
  }

  const deficit = d.importe < 0;
  const actualizado = d.actualizadoEn ? daysBetween(d.actualizadoEn, hoy) : 0;
  const faltantes = d.faltantes.filter((f) => f.tipo !== 'sin-cuentas');

  return (
    <Card className={`disponible${chica ? ' disponible-chica' : ''}${deficit ? ' disponible-deficit' : ''}`}>
      <h2 className="disponible-titulo">{titulo}</h2>
      <p className="disponible-numero" data-testid={`disponible-${moneda}`}>
        {formatMoney(d.importe, moneda)}
      </p>
      {deficit && (
        <p className="disponible-deficit-texto">
          Con lo que sabemos, faltan {formatMoney(-d.importe, moneda)} para cubrir lo que vence hasta el {formatDateMedium(d.hasta)}. Se puede revisar
          qué vence o actualizar los saldos.
        </p>
      )}
      <p className="susurro">
        {actualizado === 0 ? 'Con saldos confirmados hoy.' : `Con saldos confirmados hace ${actualizado} ${actualizado === 1 ? 'día' : 'días'}.`}{' '}
        {d.proyeccion &&
          `Si cobrás ${d.proyeccion.ingreso.nombre}${d.proyeccion.ingreso.variable ? ' (estimado)' : ''}, llegarías a ${formatMoney(d.proyeccion.siSeCobra, moneda)}.`}
      </p>
      {faltantes.length > 0 && (
        <ul className="faltantes">
          {faltantes.map((f, i) => (
            <li key={i}>{textoFaltante(f)}</li>
          ))}
        </ul>
      )}
      <div className="acciones">
        <button className="btn chico" onClick={() => abrir({ tipo: 'explicacion', moneda })}>
          ¿Cómo se calcula?
        </button>
        {deficit && (
          <button className="btn chico" onClick={() => irA('plata')}>
            Revisar lo que vence
          </button>
        )}
      </div>
    </Card>
  );
}

function ProximoCompromiso() {
  const { data } = useStore();
  const { abrir, irA } = useVentanas();
  const v = proximoVencimiento(data);
  const hoy = today();
  if (!v) {
    return (
      <Card titulo="Lo próximo que vence">
        <p>No hay nada cargado para pagar.</p>
        <button className="btn chico" onClick={() => abrir({ tipo: 'compromiso' })}>
          Agregar algo que tengo que pagar
        </button>
      </Card>
    );
  }
  const vencido = v.fecha < hoy;
  return (
    <Card titulo="Lo próximo que vence" className={vencido ? 'con-aviso' : undefined}>
      <p className="distancia" data-testid="proximo-distancia">
        {vencido ? `Venció ${distancia(hoy, v.fecha)}` : capitalizar(distancia(hoy, v.fecha))}
      </p>
      <p className="proximo-nombre">
        <strong>{v.nombre}</strong> · {v.importe === null ? 'importe a confirmar' : formatMoney(v.importe, v.moneda)}
      </p>
      <p className="susurro">{capitalizar(formatDateLong(v.fecha))}</p>
      <div className="acciones">
        <button className="btn principal" onClick={() => abrir({ tipo: 'pagar', vencimiento: v })}>
          Ya lo pagué
        </button>
        <button className="btn chico" onClick={() => irA('plata')}>
          Ver todo lo que vence
        </button>
      </div>
    </Card>
  );
}

function PasoChico() {
  const { data } = useStore();
  const { abrir, irA } = useVentanas();
  const paso = pasoSugerido(data, today());
  if (!paso) return null;
  const hacer = () => {
    switch (paso.tipo) {
      case 'primera-cuenta':
        return abrir({ tipo: 'cuenta' });
      case 'asignar-cuenta':
        return abrir({ tipo: 'asignar', movimientoId: paso.movimientoId });
      case 'importe-compromiso': {
        const k = data.compromisos.find((x) => x.id === paso.compromisoId);
        return k ? abrir({ tipo: 'compromiso', compromiso: k }) : undefined;
      }
      case 'confirmar-saldo':
        return abrir({ tipo: 'saldo', cuentaId: paso.cuentaId });
      case 'revisar-movimientos':
        return irA('plata');
    }
  };
  return (
    <Card titulo="Un paso chiquito">
      <p>{paso.texto}</p>
      <button className="btn" onClick={hacer}>
        Dale
      </button>
    </Card>
  );
}

function MetaDestacada() {
  const { data } = useStore();
  const { abrir } = useVentanas();
  const m = data.metas.find((x) => x.destacada && !x.esReserva) ?? data.metas.find((x) => x.esReserva);
  if (!m) return null;
  const hay = reservado(m, data.aportes);
  const meses = mesesCubiertos(m, hay);
  return (
    <Card titulo={m.esReserva ? 'Tu reserva' : 'Tu meta'}>
      <div className="meta-cabeza">
        {m.imagen && <img className="meta-imagen" src={m.imagen} alt="" />}
        <p>
          <strong>{m.nombre}</strong>
        </p>
      </div>
      {m.objetivo ? (
        <Progreso valor={hay} max={m.objetivo} texto={`${formatMoney(hay, m.moneda)} apartados de ${formatMoney(m.objetivo, m.moneda)}`} />
      ) : (
        <p>{formatMoney(hay, m.moneda)} apartados.</p>
      )}
      {meses !== null && <p className="susurro">Cubre unos {meses.toLocaleString('es-AR')} meses de tus gastos esenciales (según tu estimación).</p>}
      {m.pasoChico && <p>Próximo paso: {m.pasoChico}</p>}
      <button className="btn chico" onClick={() => abrir({ tipo: 'aporte', metaId: m.id })}>
        Apartar plata
      </button>
    </Card>
  );
}
