# Plan: sincronizar entre dispositivos sin poder leer los datos

Documento para decidir, no para ejecutar. Nada de esto está construido todavía.

## El problema

Hoy cada dispositivo es independiente: los datos viven en el navegador y no salen de ahí.
Exportar e importar sirve para mudarse, no para trabajar en dos lados, porque **importar
reemplaza todo**. Quien cargue en el celular y en la computadora va a perder lo de uno de los dos.

## La forma elegida, y por qué

De los dos caminos posibles, este documento desarrolla el **cifrado de punta a punta**: el
servidor guarda un bloque que no puede leer, y la llave se arma en el dispositivo a partir de una
contraseña que nunca se envía.

El otro camino —cuentas comunes, datos legibles en el servidor— es más simple de construir, pero
convierte a quien publique la app en custodia de datos de salud de pacientes ajenos. Para una
agenda de consultorio, esa responsabilidad no se compensa con la comodidad.

### Por qué no hay recuperación por mail

Si el servidor pudiera mandar un mail para recuperar la contraseña, es porque tiene manera de
reconstruir la llave. Y si él puede, también puede quien le entre al servidor, quien entre al
correo, quien lo administre o quien se lo exija legalmente. Dejaría de ser cifrado de punta a
punta: sería el otro camino con otro nombre.

En su lugar va un **código de recuperación**: una cadena larga y al azar que se genera una sola
vez y se guarda aparte (impresa, en un gestor de contraseñas). Abre los datos igual que la
contraseña, y el servidor tampoco lo tiene.

**El costo es real:** perder la contraseña *y* el código significa perder los datos, sin
excepción. Esa es la moneda con la que se paga que nadie más pueda leerlos. La interfaz tiene que
decirlo sin suavizarlo, en el momento de activar la sincronización y no escondido en una ayuda.

## Cómo funciona por dentro

**Dos secretos distintos, que conviene no confundir:**

| | Para qué | Lo sabe el servidor |
|---|---|---|
| Acceso (mail + enlace) | Saber de quién es el bloque y entregarlo | Sí |
| Contraseña de cifrado | Abrir el bloque | **No** |

Entrar a la cuenta te da el bloque cifrado. Sin la contraseña, ese bloque es ruido.

**El cifrado, paso a paso:**

1. Se genera una **llave de datos** al azar (256 bits). Es la que cifra la agenda.
2. Esa llave se guarda **envuelta dos veces**: una con una clave derivada de la contraseña, otra
   con una derivada del código de recuperación. Cualquiera de las dos la desenvuelve.
3. Los datos se cifran con AES-GCM usando la llave de datos.
4. Al servidor suben: los dos envoltorios y el bloque cifrado. Ninguno sirve sin un secreto que
   solo está en el dispositivo.

Cambiar la contraseña es volver a envolver la llave, no recifrar todo.

La derivación usa PBKDF2-SHA256 con las iteraciones que recomienda OWASP, que viene en el
navegador y no agrega dependencias. Argon2id sería mejor pero requiere traer un WASM; si más
adelante se justifica, se cambia sin tocar los datos ya guardados, porque el método queda anotado
junto a cada envoltorio.

## Lo difícil no es el cifrado: es la fusión

El cifrado es matemática conocida. Lo que rompe las apps de este tipo es qué pasa cuando alguien
editó en los dos lados.

**Guardar el bloque entero y que gane el último no alcanza**: es exactamente el problema que
venimos a resolver, con un servidor en el medio.

Hace falta fusionar registro por registro. Eso pide dos cambios en el modelo de datos:

- Cada paciente, sesión y pago lleva su **`actualizadoEn`**.
- Borrar deja una **lápida** en vez de sacar la fila, porque si no, un dispositivo viejo
  "revive" lo que el otro borró.

Con eso, fusionar es: para cada registro, gana la versión más nueva; una lápida más nueva que una
edición borra. Es predecible y se puede probar.

## Las etapas

**1. Preparar el modelo** — ✅ **hecha.** Cada paciente, sesión y pago lleva su `updatedAt`, y
borrar deja una lápida con el id y la fecha —nunca el contenido—. La migración desde la versión 1
está probada de punta a punta con datos reales.

Un detalle que apareció al construirla y que conviene no perder: la versión migrada **se guarda
enseguida**, no cuando la persona toque algo. A lo que no traía sello se le pone el del momento de
migrar, y si eso no quedara guardado, cada arranque le inventaría uno nuevo: un registro que nadie
tocó parecería recién editado cada vez que se abre la app, que es justo lo que el sello viene a
evitar.

**1 bis. La fusión** — ✅ **hecha, y en uso.** `src/lib/fusion.ts` implementa exactamente la regla
de arriba, y `src/lib/deshacer.ts` la contraparte que hacía falta: deshacer tiene que devolver el
estado anterior **con sellos frescos**, porque con los viejos la fusión elige el cambio que se
quería deshacer y no pasa nada.

No se construyó para el servidor sino para dos pestañas de la misma app abiertas a la vez, que es
el mismo problema en chico y ya estaba perdiendo datos: la segunda en guardar pisaba a la primera.
Se usa en cada guardado (`guardarFusionando`) y al escuchar el evento `storage`. Está probada con
21 pruebas unitarias y 8 de punta a punta con dos pestañas reales (`e2e/dos-pestanas.mjs`).

Lo que **no** resuelve y la etapa 4 va a tener que mirar: los ajustes no llevan sello y se toman
del lado que guarda; las lápidas se acumulan sin podarse nunca; y dos relojes desfasados entre
dispositivos pueden dejar un registro con sello futuro, que gana para siempre. Entre pestañas de
la misma máquina el reloj es uno solo, así que ahí no pasa.

**2. El módulo de cifrado** — derivar, envolver, desenvolver, cifrar, descifrar, generar el código
de recuperación. Funciones puras, con pruebas: es la parte donde un error se paga caro.

**3. El servidor** — un Worker de Cloudflare con base D1. Cuatro operaciones: pedir enlace de
acceso, validarlo, traer el bloque, subir el bloque comprobando la versión para no pisar.

**4. La sincronización en la app** — el ciclo de subir y bajar, la fusión, y la pantalla de
Ajustes: activar, escribir la contraseña, ver el código de recuperación una única vez.

**5. Lo legal y la ficha de Play** — reescribir la política de privacidad y rehacer la
declaración de datos.

Las etapas 1 y 2 no tienen vuelta atrás peligrosa y se pueden probar solas. De la 3 en adelante
hay un servidor que mantener.

## Lo que cuesta

**Alojamiento: prácticamente nada.** El plan gratuito de Cloudflare Workers da 100.000 pedidos por
día y D1 da 5 GB. Una agenda de consultorio ocupa cientos de kilobytes; entran miles de usuarias
sin pagar.

**El envío de mails sí es una dependencia nueva.** Hace falta un proveedor para los enlaces de
acceso (Resend, Postmark y similares tienen planes gratuitos de unos miles de mails por mes).

**El costo verdadero es de atención, no de plata:** pasa a haber un servidor que se puede caer,
que hay que actualizar y del que hay que hacer copias.

## Lo que cambia en Play

Aunque los datos sean ilegibles, **viajan y se guardan en un servidor**. La declaración de
seguridad de datos deja de poder decir "no se recopilan datos": hay que declarar que se
transmiten y se almacenan, aclarando que van cifrados y que quien opera la app no puede leerlos.

Sobre lo legal —en Argentina, datos de salud son datos sensibles bajo la Ley 25.326— el cifrado
de punta a punta reduce mucho la exposición pero no borra la figura de responsable de la base.
**Esto no es asesoramiento legal**: antes de publicar con sincronización conviene consultarlo con
alguien que sí lo sea.

## Los riesgos, dichos sin vueltas

- **Perder los dos secretos es perder los datos.** Sin excepción y sin rescate.
- **Un error en la fusión borra trabajo real.** Es la parte que más pruebas necesita.
- **Un servidor propio es una superficie nueva:** hay que mantenerlo y vigilarlo.

## La recomendación

**La etapa 1 ya está hecha.** Sirve igual, no compromete nada y deja la puerta abierta.

**No publicar la sincronización en la primera versión de Play.** Salir con la app local, ver si
las usuarias efectivamente la piden y con qué urgencia, y recién entonces construir las etapas 2 a
5. Media app nueva se justifica cuando hay alguien esperándola, no antes.
