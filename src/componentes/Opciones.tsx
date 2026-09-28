import './Opciones.css';

/**
 * Una elección entre pocas opciones, todas a la vista.
 *
 * Son `<input type="radio">` de verdad, escondidos detrás de la pastilla: así
 * el grupo se recorre con el teclado y el lector de pantalla lo anuncia como
 * lo que es, sin que haya que reimplementar nada de eso a mano.
 */
export default function Opciones<T extends string>({
  nombre,
  etiqueta,
  opciones,
  valor,
  alElegir,
}: {
  nombre: string;
  etiqueta: string;
  opciones: { valor: T; texto: string }[];
  valor: T;
  alElegir: (valor: T) => void;
}) {
  return (
    <fieldset className="opciones">
      <legend className="visualmente-oculto">{etiqueta}</legend>
      {opciones.map((o) => (
        <label key={o.valor} className={o.valor === valor ? 'elegida' : undefined}>
          <input
            type="radio"
            name={nombre}
            value={o.valor}
            checked={o.valor === valor}
            onChange={() => alElegir(o.valor)}
          />
          <span>{o.texto}</span>
        </label>
      ))}
    </fieldset>
  );
}
