import { normalizar } from '../finanzas/duplicados';

/**
 * Categorías sugeridas por palabra clave.
 *
 * Son una ayuda, no una obligación: la categoría nunca es obligatoria y la
 * sugerencia se puede cambiar. Ninguna se llama "gastos hormiga", "caprichos"
 * ni nada que juzgue: un café es comida afuera, no un problema.
 */
export const CATEGORIAS = [
  'Comida',
  'Comida afuera',
  'Transporte',
  'Servicios',
  'Vivienda',
  'Salud',
  'Ropa',
  'Ocio',
  'Educación',
  'Mascotas',
  'Regalos',
  'Otros',
] as const;

const PALABRAS: [string, string[]][] = [
  ['Comida', ['super', 'supermercado', 'chino', 'verduleria', 'almacen', 'carniceria', 'coto', 'dia', 'carrefour', 'jumbo', 'disco', 'changomas', 'dietetica', 'panaderia', 'feria', 'kiosco']],
  ['Comida afuera', ['cafe', 'bar', 'resto', 'restaurant', 'restaurante', 'delivery', 'rappi', 'pedidosya', 'pizza', 'birra', 'cerveza', 'helado', 'almuerzo', 'cena', 'mcdonalds', 'burger']],
  ['Transporte', ['uber', 'cabify', 'didi', 'taxi', 'remis', 'sube', 'colectivo', 'bondi', 'tren', 'subte', 'nafta', 'ypf', 'shell', 'axion', 'peaje', 'estacionamiento']],
  ['Servicios', ['luz', 'gas', 'agua', 'internet', 'celular', 'telefono', 'edenor', 'edesur', 'metrogas', 'aysa', 'personal', 'movistar', 'claro', 'fibertel', 'telecentro', 'netflix', 'spotify', 'abl', 'expensas']],
  ['Vivienda', ['alquiler', 'hipoteca', 'ferreteria', 'mueble', 'muebles']],
  ['Salud', ['farmacia', 'medico', 'remedio', 'remedios', 'psicologa', 'psicologo', 'terapia', 'prepaga', 'osde', 'swiss', 'galeno', 'dentista', 'odontologo', 'analisis']],
  ['Ropa', ['ropa', 'zapatillas', 'zapatos', 'remera', 'pantalon', 'campera']],
  ['Ocio', ['cine', 'teatro', 'recital', 'entrada', 'entradas', 'juego', 'libro', 'libros']],
  ['Educación', ['curso', 'facultad', 'colegio', 'cuota escolar', 'universidad', 'clase', 'clases']],
  ['Mascotas', ['veterinaria', 'veterinario', 'alimento perro', 'alimento gato', 'petshop']],
  ['Regalos', ['regalo', 'cumple', 'cumpleanos']],
];

/** La categoría sugerida para un comercio o una frase, o vacío si no hay una clara. */
export function categoriaPara(texto: string): string {
  const t = ` ${normalizar(texto)} `;
  for (const [categoria, palabras] of PALABRAS) {
    if (palabras.some((p) => t.includes(` ${p} `))) return categoria;
  }
  return '';
}
