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
