/** Ofrece un texto como archivo descargable. Centralizado para no repetir el
 *  baile de Blob + URL.createObjectURL + revoke en cada pantalla. */
export function downloadText(filename: string, content: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  // Liberar el objeto: si no, el blob queda en memoria hasta recargar la página.
  URL.revokeObjectURL(url);
}
