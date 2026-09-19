import { Modal } from './ui';

/**
 * La guía de uso: qué hace cada parte de la app, en criollo.
 *
 * Está escrita para leerse de un tirón la primera vez y para consultarse
 * suelta después, así que cada sección se entiende sola. Se abre desde el
 * signo de pregunta, que está siempre a mano.
 */
const SECCIONES: { titulo: string; puntos: string[] }[] = [
  {
    // Esta sección va primera a propósito. Todo lo que explica está pensado
    // para que la app no dependa de acordarse de nada; si no se sabe que
    // existe, no sirve de nada. El nombre no diagnostica a nadie: describe
    // cómo está hecha la app.
    titulo: 'Para no tener que acordarte',
    puntos: [
      'Arriba de Inicio está siempre lo que sigue, y lo más grande es cuánto falta, no la hora: "en 25 minutos" en vez de "15:00". Mientras atendés, cuenta lo que falta para terminar, y avisa cuando quedan cinco minutos.',
      'Abajo va una sola cosa por vez de lo que quedó abierto, con su botón al lado. La lista completa existe, pero se muestra de a una: no hay que elegir por dónde empezar.',
      '"Más tarde" corre esa tarjeta y muestra la que sigue. No promete nada: al volver a abrir la app, vuelve.',
      'Todo lo que tocás se puede deshacer. Abajo aparece qué acaba de pasar y un botón para volver atrás, y se queda medio minuto: si te diste cuenta después de atender el teléfono, todavía está.',
      'Si estás cargando un paciente y se cierra la pantalla, lo escrito no se pierde: la próxima vez que abras el formulario te ofrece retomarlo.',
      'Nada está en rojo por no estar hecho. La plata que todavía no entró no es un error, y la app no la trata como si lo fuera.',
    ],
  },
  {
    titulo: 'Pacientes',
    puntos: [
      'Cargá a cada persona con el botón +. Lo único obligatorio es el nombre; todo lo demás lo podés completar después.',
      'El honorario que le pongas es el que se usa al agendar, pero se puede cambiar sesión por sesión.',
      'La frecuencia (semanal, quincenal) sirve para agendar una serie entera de una sola vez.',
      'Si cargás el teléfono, aparece un botón para escribirle por WhatsApp sin salir de la app.',
      'El color es para reconocerla de un vistazo en la agenda.',
      'El tipo —particular, institución o evaluación— agrupa la lista: cada uno queda en su bloque, con cuántos hay. Si tenés un solo tipo cargado, no aparece ningún rótulo.',
    ],
  },
  {
    titulo: 'Agenda',
    puntos: [
      'El calendario muestra el mes. Tocá un día para ver o agregar sesiones.',
      'Al agendar podés elegir que se repita: se crean todas las sesiones de una vez, sin cargarlas una por una.',
      'Cada sesión puede quedar como realizada, cancelada o ausente. Eso es lo que después se factura.',
      'El cierre del día 🌙 repasa las sesiones de la jornada y te deja marcarlas todas juntas, con sus cobros. Es el atajo de fin de día, y termina con el resumen de lo que hiciste.',
      'Si al cerrar el día te olvidás de alguien o te equivocás, se arregla después: la sesión se edita desde la Agenda y el cobro se borra desde Finanzas. Nada queda cerrado con llave.',
      'Si cargaste el teléfono del paciente, cada turno agendado tiene un botón para escribirle por WhatsApp con el mensaje ya armado: recordarle el turno, pedirle que confirme o reprogramar. Se abre WhatsApp con el texto escrito; mandarlo lo hacés vos.',
      'El botón del cierre aparece solo cuando hay sesiones sin resolver: en Inicio para las de hoy, y en Agenda para el día que estés mirando. Si no lo ves, es que no quedó nada pendiente.',
    ],
  },
  {
    titulo: 'Finanzas',
    puntos: [
      'Resumen: lo facturado y lo cobrado del mes, la diferencia y cuánto te deben en total.',
      'La meta del mes es opcional. Si no sabés cuánto ponerte, la calculadora te propone un número a partir de lo que necesitás por mes.',
      'Monitoreo: gráficos de quién pagó, quién debe y cómo viene la asistencia.',
      'Facturación: los datos fiscales de cada paciente y el texto de la factura listo para copiar y pegar.',
    ],
  },
  {
    titulo: 'Ajustes y tu copia de seguridad',
    puntos: [
      'Los datos viven en este dispositivo y en ningún otro lado. No hay servidor ni cuenta: nadie más los ve, y tampoco viajan solos a otro teléfono.',
      'Por eso: exportá una copia cada tanto y guardala donde la vayas a encontrar (el mail, Drive, lo que uses).',
      'Si cambiás de teléfono o limpiás la caché del navegador, se borra todo. La copia es la única forma de recuperarlo.',
      'La app funciona en un dispositivo por vez, a propósito: no se sincroniza entre tu celular y tu computadora. Sincronizar obligaría a mandar tus pacientes a un servidor y a protegerlos con una contraseña que, de perderse, nadie podría devolverte. Para pasar de un dispositivo a otro se exporta y se importa.',
      'Importar vuelve a poner una copia. Reemplaza lo que haya cargado en ese momento.',
      'En Ajustes también está la política de privacidad, que explica en detalle por qué tus datos no salen de acá.',
    ],
  },
  {
    titulo: 'Detalles',
    puntos: [
      'La app funciona sin internet. Una vez abierta, se puede usar en el subte o donde no haya señal.',
      'Se instala desde el navegador: menú ⋮ → Instalar aplicación en Android, o compartir → Agregar a inicio en iPhone.',
      'La app se puede ver clara u oscura. En Ajustes › Cómo se ve; "automático" sigue lo que tengas puesto en el teléfono.',
      'El perro salchicha del pie no hace nada útil. Tocalo igual.',
    ],
  },
];

export function Guia({ onClose, onVerCarteles }: { onClose: () => void; onVerCarteles: () => void }) {
  return (
    <Modal title="Guía de uso" onClose={onClose}>
      <div className="guia">
        <p className="guia-intro">
          Pipí Cucú lleva tus pacientes, tu agenda y tus honorarios. Nada se envía a ningún servidor:
          todo queda en este dispositivo.
        </p>

        {SECCIONES.map((s) => (
          <section key={s.titulo} className="guia-bloque">
            <h3>{s.titulo}</h3>
            <ul>
              {s.puntos.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </section>
        ))}

        <button type="button" className="btn" onClick={onVerCarteles}>
          Volver a ver los carteles
        </button>
      </div>
    </Modal>
  );
}
