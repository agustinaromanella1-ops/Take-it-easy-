# Integraciones bancarias

**Estado: no hay ninguna.** Salchi no se conecta a bancos ni billeteras, y no dice que lo haga.

## Por qué

- En Argentina no hay, hoy, una interfaz abierta y estándar para que una app lea los movimientos
  de cualquier banco con permiso de la persona (como el "open banking" de otros países). Cada
  banco tiene la suya, cuando la tiene, y en general no está abierta a terceros.
- Los agregadores privados que existen piden, en muchos casos, el usuario y la clave del home
  banking. Guardar o transmitir esas claves contradice todo lo que promete Salchi y suele violar
  los términos del banco.
- Ninguna integración se pudo verificar desde acá. El pedido original lo dice: no prometer
  compatibilidad bancaria sin verificarla.

## Lo que sí hay, y es el camino de entrada para cualquier conector futuro

Todo lo que viene de afuera pasa por el mismo flujo de revisión:

1. `src/lib/importar/csv.ts` convierte filas a `FilaImportada` (fecha, descripción, importe con
   signo, categoría sugerida, posibles duplicados).
2. `src/components/Importar.tsx` las muestra: lo repetido viene destildado, nada entra sin mirarlo.
3. Entran con `origen: 'importado'` y `aRevisar: true`, en una sola acción que se puede deshacer.

Un conector bancario, el día que exista uno verificable, tiene que producir `FilaImportada[]` y
entrar por el paso 2. No tiene que escribir en los datos por su cuenta.

## Lo que haría falta verificar antes de agregar uno

- Que use autorización delegada (OAuth o similar) y **nunca** la clave del home banking.
- Que el permiso sea solo de lectura, revocable desde el banco, y con vencimiento.
- Qué datos ve el intermediario, dónde los guarda y por cuánto tiempo; que se pueda decir en la
  política de privacidad con la misma claridad que hoy.
- Que funcione sin un servidor de Salchi que vea movimientos en claro; si no se puede, que sea
  opcional y se avise antes, como el dictado.
- Pruebas con cuentas reales de al menos los bancos más usados, y qué pasa cuando el banco cambia
  su formato (tiene que fallar a la vista, no importar basura).
