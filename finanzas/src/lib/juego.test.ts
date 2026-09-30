import { huellitasVacias } from './storage';
import { ALMOHADILLAS, COMPLETAS_POR_DIA, registrarAccion, TRUCOS } from './huellitas/huellitas';
import { debeAparecer } from './hormiga';
import { esPausa } from './pausa';
import type { AccionHuellita, Huellitas } from '../types';

const T = '2026-09-15T12:00:00.000Z';
const TODAS: AccionHuellita[] = ['anotar', 'actualizar-saldo', 'confirmar-compromiso', 'revisar-movimientos', 'comprobante', 'retomar', 'revision-breve'];

describe('huellitas', () => {
  it('cada clase de acción suma una sola vez por día: anotar diez gastos no vale más que uno', () => {
    let h = huellitasVacias();
    for (let i = 0; i < 10; i++) h = registrarAccion(h, 'anotar', '2026-09-15', T).huellitas;
    expect(h.almohadillas).toBe(1);
  });

  it('cinco acciones distintas completan la huella y el perro aprende el primer truco', () => {
    let h = huellitasVacias();
    let ultimo = null;
    for (const a of TODAS.slice(0, ALMOHADILLAS)) {
      ultimo = registrarAccion(h, a, '2026-09-15', T);
      h = ultimo.huellitas;
    }
    expect(ultimo).toMatchObject({ truco: 'patita', nuevo: true });
    expect(h).toMatchObject({ almohadillas: 0, totalCompletas: 1, trucos: ['patita'] });
  });

  it('hay un tope de huellas completas por día', () => {
    let h: Huellitas = { ...huellitasVacias(), almohadillas: 4, hoy: { fecha: '2026-09-15', acciones: [], completas: COMPLETAS_POR_DIA } };
    const r = registrarAccion(h, 'anotar', '2026-09-15', T);
    expect(r.sumo).toBe(false);
    h = registrarAccion(h, 'anotar', '2026-09-16', T).huellitas;
    expect(h.trucos).toHaveLength(1);
  });

  it('nada se pierde por no entrar: tras 60 días, lo lleno sigue lleno y los trucos siguen', () => {
    const h: Huellitas = { ...huellitasVacias(), almohadillas: 3, trucos: ['patita', 'saltito'], hoy: { fecha: '2026-07-01', acciones: ['anotar'], completas: 0 } };
    const r = registrarAccion(h, 'retomar', '2026-09-15', T);
    expect(r.huellitas.almohadillas).toBe(4);
    expect(r.huellitas.trucos).toEqual(['patita', 'saltito']);
  });

  it('con todos los trucos aprendidos, repite los que sabe sin perder ninguno', () => {
    const h: Huellitas = { ...huellitasVacias(), almohadillas: 4, trucos: TRUCOS.map((t) => t.id), totalCompletas: 6 };
    const r = registrarAccion(h, 'anotar', '2026-09-15', T);
    expect(r.nuevo).toBe(false);
    expect(r.truco).not.toBeNull();
    expect(r.huellitas.trucos).toHaveLength(TRUCOS.length);
  });
});

describe('hormiga', () => {
  const ctx = { activada: true, enHoy: true, ocupada: false, bajaEnergia: false, hayCuentas: true };
  const nunca = { ultimaAparicion: null, descartadaEl: null };

  it('aparece si nada lo impide', () => expect(debeAparecer(nunca, ctx, '2026-09-15')).toBe(true));
  it('no aparece desactivada, en otra pantalla, en una tarea delicada ni en baja energía', () => {
    expect(debeAparecer(nunca, { ...ctx, activada: false }, '2026-09-15')).toBe(false);
    expect(debeAparecer(nunca, { ...ctx, enHoy: false }, '2026-09-15')).toBe(false);
    expect(debeAparecer(nunca, { ...ctx, ocupada: true }, '2026-09-15')).toBe(false);
    expect(debeAparecer(nunca, { ...ctx, bajaEnergia: true }, '2026-09-15')).toBe(false);
  });
  it('como mucho una vez cada 3 días', () => {
    expect(debeAparecer({ ...nunca, ultimaAparicion: '2026-09-13' }, ctx, '2026-09-15')).toBe(false);
    expect(debeAparecer({ ...nunca, ultimaAparicion: '2026-09-12' }, ctx, '2026-09-15')).toBe(true);
  });
  it('después de "Ahora no" descansa 7 días', () => {
    expect(debeAparecer({ ultimaAparicion: '2026-09-01', descartadaEl: '2026-09-10' }, ctx, '2026-09-15')).toBe(false);
    expect(debeAparecer({ ultimaAparicion: '2026-09-01', descartadaEl: '2026-09-08' }, ctx, '2026-09-15')).toBe(true);
  });
});

describe('pausa', () => {
  it('siete días sin abrir es pausa; seis no; la primera vez tampoco', () => {
    expect(esPausa('2026-09-08', '2026-09-15')).toBe(true);
    expect(esPausa('2026-09-09', '2026-09-15')).toBe(false);
    expect(esPausa(null, '2026-09-15')).toBe(false);
  });
});
