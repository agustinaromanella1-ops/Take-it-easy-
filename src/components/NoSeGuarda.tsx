import { useStore } from '../store/StoreContext';

/**
 * El aviso de que la app dejó de guardar.
 *
 * Es el único cartel de la app que no se puede cerrar ni se va solo, y va
 * arriba de todo. No es una molestia: mientras esté, todo lo que se escriba se
 * pierde al cerrar. Los datos viven únicamente en este navegador, así que no
 * hay ningún otro lado del que recuperarlos.
 *
 * La causa habitual es el almacenamiento lleno. Por eso lo que ofrece es
 * exportar: la copia se descarga como archivo y no depende del espacio que
 * falta.
 */
export function NoSeGuarda() {
  const { noSeGuarda } = useStore();
  if (!noSeGuarda) return null;

  return (
    <div className="no-se-guarda" role="alert">
      <strong>No se están guardando los cambios.</strong>{' '}
      Puede ser que el navegador se haya quedado sin espacio. Exportá una copia desde Ajustes antes
      de cerrar la app: lo que cargues mientras tanto se va a perder.
    </div>
  );
}
