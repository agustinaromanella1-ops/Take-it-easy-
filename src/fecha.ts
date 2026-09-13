// Las fechas de calendario son texto local, nunca marcas de tiempo UTC:
// después de las 21 h en Argentina el UTC ya es el día siguiente.

export type FechaLocal = string; // YYYY-MM-DD

export function hoy(): FechaLocal {
  const ahora = new Date();
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');
  return `${ahora.getFullYear()}-${mes}-${dia}`;
}

const nombreDia = new Intl.DateTimeFormat('es-AR', { weekday: 'long' });
const diaYMes = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long' });

export function enPalabras(fecha: FechaLocal): string {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  // new Date('2026-09-09') se interpreta como UTC y en Argentina cae un día antes.
  const fechaLocal = new Date(anio, mes - 1, dia);
  return `${nombreDia.format(fechaLocal)} ${diaYMes.format(fechaLocal)}`;
}

/** 1 lunes … 7 domingo, como ISO 8601. */
export type DiaSemana = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const DIAS: { dia: DiaSemana; letra: string; nombre: string }[] = [
  { dia: 1, letra: 'L', nombre: 'lunes' },
  { dia: 2, letra: 'M', nombre: 'martes' },
  { dia: 3, letra: 'M', nombre: 'miércoles' },
  { dia: 4, letra: 'J', nombre: 'jueves' },
  { dia: 5, letra: 'V', nombre: 'viernes' },
  { dia: 6, letra: 'S', nombre: 'sábado' },
  { dia: 7, letra: 'D', nombre: 'domingo' },
];

export function diaSemanaDe(fecha: FechaLocal): DiaSemana {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  // getDay() cuenta 0 = domingo; acá el domingo es 7 y la semana empieza el lunes.
  const deJs = new Date(anio, mes - 1, dia).getDay();
  return (deJs === 0 ? 7 : deJs) as DiaSemana;
}

/** "09:20" como minutos desde la medianoche, para poder comparar horarios. */
export function enMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

export function horaActualEnMinutos(ahora = new Date()): number {
  return ahora.getHours() * 60 + ahora.getMinutes();
}
