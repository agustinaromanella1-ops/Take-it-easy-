# PsicoFinance

Agenda y finanzas para consultorio psicológico. Gestiona pacientes, turnos, honorarios y cobros,
y muestra en todo momento cuánto se facturó, cuánto se cobró y quién debe.

## Cómo usarla

```bash
npm install
npm run dev      # abre http://localhost:5173
```

Para publicarla (Netlify, Vercel, GitHub Pages o un pendrive):

```bash
npm run build    # genera dist/
```

La carpeta `dist/` es HTML estático: no necesita servidor ni base de datos.

## Qué hace

**Inicio.** Facturado y cobrado del mes, deuda pendiente y turnos de la semana. Avisa de las
sesiones que ya pasaron pero siguen sin cerrar y permite cerrarlas ahí mismo.

**Pacientes.** Alta, edición y baja, con honorario habitual, datos de contacto y notas. Cada
paciente tiene su ficha con el historial de sesiones y de pagos, y su saldo.

**Agenda.** Vista semanal con navegación entre semanas. Detecta y marca turnos superpuestos,
tanto en la grilla como al cargar uno nuevo. El estado de cada sesión se cambia desde la tabla.

**Finanzas.** Comparación de facturado contra cobrado mes a mes, lista de saldos pendientes y
registro de pagos con un botón para saldar la deuda completa de un paciente.

**Ajustes.** Moneda, duración por defecto, política de ausencias, y exportar/importar los datos.

## Estética

Serif de display (Playfair Display) para títulos y cifras principales, sans redondeada (Nunito)
para el cuerpo, fondo en degradado pastel, tarjetas muy redondeadas y acento turquesa. En celular
la navegación pasa a una barra inferior con un botón flotante para la acción principal de cada
pantalla. Las fuentes se cargan desde Google Fonts y degradan a Georgia y la tipografía del
sistema si no hay conexión.

## Decisiones de diseño

**El dinero se guarda en centavos, como entero.** Sumar decimales acumula error de redondeo:
`0.1 + 0.2` no da `0.3` en punto flotante. Todo el cálculo es entero y solo se formatea al
mostrarlo (`src/lib/money.ts`). El parser acepta tanto `1.500,50` como `1,500.50`, y al mostrar
se omiten los centavos cuando son cero: `$ 35.000`, no `$ 35.000,00`.

**Las fechas son `YYYY-MM-DD` en hora local, no timestamps UTC.** `new Date("2026-03-10")` se
interpreta como UTC y puede correr el día según la zona horaria; un turno del martes a las 15:00
tiene que seguir siendo el martes a las 15:00 (`src/lib/dates.ts`).

**El honorario se congela en cada sesión.** Se copia del paciente al agendar, pero después no se
toca: subir la tarifa no debe reescribir lo ya facturado.

**Una sesión genera deuda solo si se realizó, o si fue una ausencia marcada como cobrable.** Las
canceladas y las todavía programadas no cuentan. El saldo de un paciente es facturado − pagado;
si es negativo, tiene crédito a favor.

**Lo que vuelve de `localStorage` se valida campo por campo** (`src/lib/storage.ts`). Es texto que
pudo corromperse o quedar de una versión vieja; se descarta lo inválido en vez de confiar en un
`as AppData` y que la app explote más tarde y lejos de la causa.

**Borrar un paciente arrastra sus sesiones y pagos.** Dejarlos sueltos produciría ingresos
fantasma en los reportes, imposibles de rastrear.

**Al cerrar la pestaña solo se guarda si hay cambios propios sin escribir.** Sin esa condición,
una pestaña que nunca tocó nada igual escribiría su copia al cerrarse y pisaría lo que guardó
otra pestaña abierta en paralelo (`src/store/StoreContext.tsx`).

## Dónde viven los datos

Todo se guarda en el navegador (`localStorage`), en esta computadora. No hay servidor ni cuenta:
nada se envía a ningún lado. Como contrapartida, **limpiar la caché o cambiar de computadora
borra el historial**, así que conviene exportar una copia desde Ajustes cada tanto.

## Desarrollo

```bash
npm test          # 67 tests unitarios
npm run typecheck # TypeScript en modo strict
npm run build
```

```
src/
├── types.ts            Modelo de datos
├── lib/                money, dates, storage, id — lógica pura, sin React
├── store/              reducer, selectores y contexto
├── components/ui.tsx   Card, Stat, Modal, Field
└── pages/              Dashboard, Patients, PatientDetail, Agenda, Finance, Settings
```

La lógica de negocio vive en `lib/` y `store/`, sin depender de React, y es la parte cubierta por
los tests. Los componentes solo muestran lo que esas funciones calculan.
