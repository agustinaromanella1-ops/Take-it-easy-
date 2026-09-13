export interface Template {
  id: string;
  name: string;
  body: string;
  createdAt: string;
}

/**
 * Las variables se escriben {asi}. Aceptamos acentos y ñ porque la idea es
 * escribirlas en castellano ({nombre}, {día}, {año}).
 */
const VARIABLE_RE = /\{([\p{L}\p{N}_ -]{1,40})\}/gu;

/** Nombres de variable únicos, en el orden en que aparecen en el texto. */
export function extractVariables(body: string): string[] {
  const found: string[] = [];
  for (const match of body.matchAll(VARIABLE_RE)) {
    const name = match[1]?.trim();
    if (name && !found.includes(name)) found.push(name);
  }
  return found;
}

/**
 * Reemplaza las variables que tengan valor. Las que quedan sin completar se
 * dejan visibles tal como están: es preferible que se note un {nombre} sin
 * llenar a mandar un mensaje con un hueco silencioso.
 */
export function renderTemplate(
  body: string,
  values: Record<string, string>,
): string {
  return body.replace(VARIABLE_RE, (original, rawName: string) => {
    const value = values[rawName.trim()];
    return value && value.trim() ? value.trim() : original;
  });
}

/** Variables que todavía no tienen valor, para poder avisar antes de programar. */
export function missingVariables(
  body: string,
  values: Record<string, string>,
): string[] {
  return extractVariables(body).filter(
    (name) => !values[name] || !values[name]?.trim(),
  );
}
