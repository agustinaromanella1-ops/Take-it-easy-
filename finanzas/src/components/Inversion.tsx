import { useState } from 'react';
import { useStore } from '../store/StoreContext';
import { useVentanas } from './Ventanas';
import { Aviso, Field, Llave, Modal, Opciones } from './ui';
import { EJEMPLO, parsePorcentaje, simularInversion } from '../lib/finanzas/inversion';
import { formatTasa } from '../lib/finanzas/escenarios';
import { mesesCubiertos, reservado } from '../lib/finanzas/metas';
import { esDeuda, saldo } from '../lib/finanzas/saldos';
import { formatMoney, parseMoney } from '../lib/money';

/**
 * Inversión, en modo aprender. No hay productos, ni tasas del mercado, ni
 * recomendaciones, ni botones para operar: preguntas para pensar antes, un
 * simulador que muestra también las pérdidas, y un glosario.
 */
type Pestana = 'antes' | 'simular' | 'palabras';

export function Inversion() {
  const { cerrar } = useVentanas();
  const [pestana, setPestana] = useState<Pestana>('antes');
  return (
    <Modal titulo="Aprender sobre inversión" onClose={cerrar} ancho>
      <Aviso>Es para aprender y hacer cuentas. No es una recomendación ni asesoramiento, y nada de esto mueve plata.</Aviso>
      <Opciones<Pestana>
        legend="Sección"
        ocultarLegend
        valor={pestana}
        opciones={[
          { valor: 'antes', texto: 'Antes de empezar' },
          { valor: 'simular', texto: 'Simular' },
          { valor: 'palabras', texto: 'Palabras' },
        ]}
        onChange={setPestana}
      />
      {pestana === 'antes' && <Antes />}
      {pestana === 'simular' && <Simular />}
      {pestana === 'palabras' && <Palabras />}
    </Modal>
  );
}

type Horizonte = 'corto' | 'medio' | 'largo';
type Necesita = 'si' | 'no' | 'nose';
type Reaccion = 'vender' | 'esperar' | 'nose';

function Antes() {
  const { data } = useStore();
  const [horizonte, setHorizonte] = useState<Horizonte | ''>('');
  const [necesita, setNecesita] = useState<Necesita | ''>('');
  const [reaccion, setReaccion] = useState<Reaccion | ''>('');

  const reserva = data.metas.find((m) => m.esReserva);
  const hayReserva = reserva ? reservado(reserva, data.aportes) : 0;
  const meses = reserva ? mesesCubiertos(reserva, hayReserva) : null;
  const deudasCaras = data.cuentas.filter((c) => esDeuda(c) && !c.archivada && c.tasaAnual !== null && saldo(c, data.movimientos) > 0);

  const notas: string[] = [];
  if (horizonte === 'corto' || necesita === 'si') {
    notas.push('Para plata que puede hacer falta pronto, importa más poder sacarla rápido y sin perder (liquidez) que lo que pueda rendir.');
  }
  if (necesita === 'nose') notas.push('Si no sabés si la vas a necesitar, una parte puede quedar a mano y otra a más plazo. No tiene que ser todo o nada.');
  if (horizonte === 'largo') notas.push('Con más tiempo por delante, una caída tiene más margen para recuperarse. Igual puede no recuperarse: el tiempo ayuda, no garantiza.');
  if (reaccion === 'vender') {
    notas.push('Vender en plena caída es la forma más común de convertir una baja en una pérdida. Si te pasaría, te pueden servir opciones con menos subas y bajas, aunque rindan menos.');
  }
  if (reaccion === 'esperar') notas.push('Esperar sirve si no vas a necesitar esa plata en el medio. Por eso importa tener la reserva armada antes.');

  return (
    <div>
      <h3>Lo que ya sabe la app</h3>
      <ul className="reglas">
        <li>
          {reserva
            ? `Tu reserva tiene ${formatMoney(hayReserva, reserva.moneda)}${meses !== null ? `, unos ${meses.toLocaleString('es-AR')} meses de esenciales` : ''}. Muchas guías sugieren armarla antes de invertir: es lo que evita tener que vender en un mal momento.`
            : 'Todavía no armaste una reserva para imprevistos. Muchas guías sugieren tenerla antes de invertir: es lo que evita tener que vender en un mal momento.'}
        </li>
        {deudasCaras.map((c) => (
          <li key={c.id}>
            {c.nombre} tiene una tasa de {formatTasa(c.tasaAnual ?? 0)} anual. Una deuda cara suele crecer más rápido de lo que rinde la mayoría de las
            inversiones: vale la pena mirarla en los escenarios de deuda.
          </li>
        ))}
      </ul>

      <h3>Tres preguntas</h3>
      <Opciones<Horizonte>
        legend="¿Para cuándo sería esta plata?"
        valor={horizonte as Horizonte}
        opciones={[
          { valor: 'corto', texto: 'Menos de un año' },
          { valor: 'medio', texto: 'De uno a tres años' },
          { valor: 'largo', texto: 'Más de tres años' },
        ]}
        onChange={setHorizonte}
      />
      <Opciones<Necesita>
        legend="¿Podrías necesitarla antes, por un imprevisto?"
        valor={necesita as Necesita}
        opciones={[
          { valor: 'si', texto: 'Sí' },
          { valor: 'no', texto: 'No' },
          { valor: 'nose', texto: 'No sé' },
        ]}
        onChange={setNecesita}
      />
      <Opciones<Reaccion>
        legend="Si un mes valiera 20 % menos, ¿qué harías?"
        valor={reaccion as Reaccion}
        opciones={[
          { valor: 'vender', texto: 'La sacaría toda' },
          { valor: 'esperar', texto: 'Esperaría' },
          { valor: 'nose', texto: 'No sé' },
        ]}
        onChange={setReaccion}
      />
      {notas.length > 0 && (
        <>
          <h3>Para tener en cuenta</h3>
          <ul className="reglas" aria-live="polite">
            {notas.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </>
      )}
      <p className="susurro">Las respuestas no se guardan: son para pensar, no un perfil.</p>
    </div>
  );
}

function Simular() {
  const [inicial, setInicial] = useState('100000');
  const [aporte, setAporte] = useState('20000');
  const [meses, setMeses] = useState('24');
  const [inflacion, setInflacion] = useState(String(EJEMPLO.inflacionMensual / 100).replace('.', ','));
  const [tasas, setTasas] = useState(EJEMPLO.escenarios.map((e) => String(e.tasaMensual / 100).replace('.', ',')));
  const [conCaida, setConCaida] = useState(false);

  const ini = parseMoney(inicial) ?? 0;
  const ap = parseMoney(aporte) ?? 0;
  const n = Math.max(1, Math.min(600, Number(meses) || 0));
  const inf = parsePorcentaje(inflacion);

  return (
    <div>
      <p className="susurro">Los números de ejemplo no son pronósticos ni tasas de ningún producto. Cambialos por los que quieras probar.</p>
      <div className="fila">
        <Field label="Para empezar">
          <input inputMode="decimal" value={inicial} onChange={(e) => setInicial(e.target.value)} />
        </Field>
        <Field label="Por mes">
          <input inputMode="decimal" value={aporte} onChange={(e) => setAporte(e.target.value)} />
        </Field>
      </div>
      <div className="fila">
        <Field label="Meses">
          <input inputMode="numeric" value={meses} onChange={(e) => setMeses(e.target.value.replace(/\D/g, ''))} />
        </Field>
        <Field label="Inflación por mes, %">
          <input inputMode="decimal" value={inflacion} onChange={(e) => setInflacion(e.target.value)} />
        </Field>
      </div>
      <Llave label="Simular una caída de 30 % en el tercer mes" ayuda="Pasa. Sirve para ver si lo aguantarías." checked={conCaida} onChange={setConCaida} />
      <ul className="lista escenarios">
        {EJEMPLO.escenarios.map((e, i) => {
          const tasa = parsePorcentaje(tasas[i] ?? '');
          const r =
            tasa === null || inf === null
              ? null
              : simularInversion({ inicial: ini, aporteMensual: ap, meses: n, tasaMensual: tasa, inflacionMensual: inf, caida: conCaida ? { mes: 3, porcentaje: 3000 } : null });
          return (
            <li key={e.nombre} className="escenario">
              <Field label={`${e.nombre}: rinde por mes, %`}>
                <input inputMode="decimal" value={tasas[i]} onChange={(ev) => setTasas((t) => t.map((x, j) => (j === i ? ev.target.value : x)))} />
              </Field>
              {r === null ? (
                <p className="susurro">Falta un número para calcular.</p>
              ) : (
                <div data-testid={`escenario-${i}`}>
                  <p>
                    Ponés {formatMoney(r.aportado)} y al final hay <strong>{formatMoney(r.final)}</strong>, que en pesos de hoy son unos{' '}
                    <strong>{formatMoney(r.finalReal)}</strong>.
                  </p>
                  {r.peorDiferencia < 0 ? (
                    <p className="aviso aviso-warn">
                      En el peor momento (mes {r.peorMes}) había {formatMoney(-r.peorDiferencia)} menos de lo que pusiste.
                    </p>
                  ) : (
                    <p className="susurro">En ningún mes hubo menos de lo que pusiste.</p>
                  )}
                  {r.finalReal < r.aportado && r.final >= r.aportado && (
                    <p className="susurro">Crece en pesos, pero menos que la inflación supuesta: en pesos de hoy, es menos de lo que pusiste.</p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <h3>Supuestos</h3>
      <ul className="reglas">
        <li>El rendimiento y la inflación son iguales todos los meses. En la realidad cambian.</li>
        <li>No hay comisiones ni impuestos. En la realidad los hay y bajan el resultado.</li>
        <li>Nadie puede prometer un rendimiento. Si alguien lo promete alto y seguro, es una señal de alarma.</li>
      </ul>
    </div>
  );
}

const GLOSARIO: [string, string][] = [
  ['Inflación', 'Cuánto suben los precios. Si tu plata crece menos que la inflación, con ella podés comprar menos que antes, aunque el número sea más grande.'],
  ['Tasa nominal anual (TNA)', 'La tasa que se anuncia por año. La mensual se calcula dividiéndola por 12. No incluye el efecto de reinvertir lo ganado.'],
  ['Tasa efectiva anual (TEA)', 'Lo que rinde (o cuesta) en un año reinvirtiendo lo ganado cada mes. Siempre es mayor que la nominal.'],
  ['Liquidez', 'Qué tan rápido y sin perder se puede recuperar la plata. Una reserva para imprevistos necesita mucha liquidez.'],
  ['Riesgo', 'La posibilidad de que el resultado sea distinto del esperado, incluso perder. En general, más rendimiento posible viene con más riesgo.'],
  ['Horizonte', 'Cuánto tiempo podés dejar la plata sin tocarla. Cuanto más corto, menos riesgo conviene poder aguantar.'],
  ['Diversificar', 'No poner todo en lo mismo. Si algo sale mal, no sale mal todo junto.'],
  ['Plazo fijo', 'Dejás plata en un banco por un tiempo fijo a una tasa pactada. No se puede sacar antes sin perder lo pactado.'],
  ['Fondo común de inversión', 'Mucha gente pone plata y una administradora la invierte. Hay de muchos tipos, con distinto riesgo y liquidez.'],
  ['Comisiones', 'Lo que cobran por invertir o por administrar. Parecen chicas, pero se descuentan todos los meses.'],
  ['Señales de estafa', 'Rendimientos altos "garantizados", apuro para decidir, pedido de claves o de transferencias a cuentas personales, y "invitá a otros para ganar más".'],
];

function Palabras() {
  return (
    <dl className="glosario">
      {GLOSARIO.map(([t, d]) => (
        <div key={t}>
          <dt>{t}</dt>
          <dd>{d}</dd>
        </div>
      ))}
    </dl>
  );
}
