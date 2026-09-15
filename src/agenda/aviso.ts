/**
 * El texto de una notificación. Es fijo y sale de un caso, nunca de lo que
 * escribió la docente.
 *
 * Una notificación se lee en la pantalla bloqueada, a la vista de cualquiera
 * que esté cerca. Una entrada que diga "hablar con Delfina sobre el trabajo"
 * es razonable de escribir, y mostrarla ahí publica el nombre de una alumna.
 * Por eso esta función no recibe el título de la entrada: no es que no lo use,
 * es que no lo tiene.
 */

export type Aviso =
  | { caso: 'nota-de-clase'; materia: string }
  | { caso: 'evaluacion'; materia: string }
  | { caso: 'sin-materia' };

export interface Texto {
  titulo: string;
  cuerpo: string;
}

/**
 * La materia y el curso sí van en el título: no son datos de un alumno, y sin
 * ellos la notificación no dice nada útil.
 *
 * Ningún texto promete una hora. Los recordatorios son inexactos y pueden
 * llegar más tarde: un "en diez minutos" va a estar mal seguido.
 */
export function textoDelAviso(aviso: Aviso): Texto {
  switch (aviso.caso) {
    case 'nota-de-clase':
      return { titulo: aviso.materia, cuerpo: 'Tenés una nota para esta clase.' };
    case 'evaluacion':
      return { titulo: aviso.materia, cuerpo: 'Hoy tenés una evaluación anotada.' };
    case 'sin-materia':
      return { titulo: 'Take It Easy', cuerpo: 'Tenés una nota para hoy.' };
  }
}
