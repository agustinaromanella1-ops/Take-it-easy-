# Icono de la app

Tres direcciones, dibujadas en SVG y renderizadas a PNG.

```bash
node icono/direcciones.mjs
```

Genera en `salida/`: cada dirección en SVG, en PNG de 1024 y de 48, más una hoja
comparativa `prueba-48px.png` con las tres a tamaño real ampliadas sin suavizado.

## El punto de partida

El icono de **Pipí Cucú** es tipográfico: una "P" de Playfair Display sobre un degradado
pastel en diagonal, con el acento en naranja. **No usa** el contorno grueso ni la sombra
dura — ese registro es el del perro, no el del icono. Para que las dos apps se vean
hermanas en la pantalla de inicio, el icono nuevo tiene que estar en ese mismo registro.

Valores tomados del PNG original (`public/icon-512.png` en `main`):

| | |
|---|---|
| Degradado | `#e8e3f5` arriba izquierda → `#fde4d6` abajo derecha |
| Tinta de la letra | `#2f6273` |
| Acento | `#ad5417` |

Ojo: ese teal **no** está en la paleta del CSS de la app, que usa `--ink: #1f1e47`. El
icono tiene su propia tinta, y es esa la que hay que igualar.

## El icono elegido

Agustina eligió la burbuja con el reloj a las nueve y mandó una versión sobre verde
saturado. El dibujo quedó tal cual; lo que cambió es el color y el soporte.

**Por qué no ese verde.** El suyo era `#058065`, a distancia 89 del verde de WhatsApp
(`#25d366`) en RGB. Una burbuja de chat sobre un verde así se lee como "app oficial de
WhatsApp", que para una app cuya función es justamente abrir WhatsApp es el mayor riesgo de
rechazo en la tienda que tenemos. La tinta de la app, `#123f3c`, está a distancia 155: casi
el doble de lejos, y además es el color con el que ya está pintada la app entera.

**Por qué redibujarlo.** La imagen original era un PNG con sombra y bordes suaves. A 48 px
—el tamaño real en el cajón de apps— eso se convierte en una mancha. El vector mantiene el
filo a cualquier tamaño.

Hay dos variantes generadas:

- **`a-tinta`** — la composición original con la tinta de la app.
- **`b-atardecer`** — la versión de familia: el mismo cielo pastel del icono de Pipí Cucú,
  con la burbuja en tinta y el minutero en coral. **Es la que se publica.**

Para cambiar cuál se publica, la constante `ELEGIDA` en `generar.mjs`. Los parámetros de
cada variante están en `RECETAS` y los usan tanto las vistas previas como los archivos
finales, así que cambiar la constante cambia de verdad lo que se exporta.

## Archivos que se generan

`node icono/generar.mjs` escribe en `assets/`:

| Archivo | Para qué |
|---|---|
| `icon.png` | iOS y respaldo. Cuadrado lleno, sin transparencia ni esquinas redondeadas propias: la máscara la aplica el sistema. |
| `adaptive-icon.png` | Primer plano de Android, achicado al 92 % para que el dibujo entre en el 66 % central que ninguna máscara recorta. El fondo lo pone `app.json`. |
| `splash-icon.png` | Pantalla de arranque en claro. Burbuja en tinta sobre el verde agua del fondo: 9,98:1. |
| `splash-icon-dark.png` | La misma en modo oscuro, con la burbuja en crema. Con la de tinta daba 1,41:1 sobre el fondo oscuro, o sea un rectángulo casi uniforme. |

El centro óptico no es el geométrico: la colita corre el dibujo hacia abajo y a la derecha,
y sin corregirlo el icono se ve desplazado dentro de su cuadrado.

## Las tres direcciones anteriores

### A — La letra con el acento

Una "L" de Playfair Display en tinta, con un relojito naranja donde la "P" tiene su tilde.
El acento cambia de significado —de tilde a hora— pero conserva la posición y el color.

- **A favor:** es el hermano más directo. Al lado del icono de Pipí Cucú se lee como la
  misma familia sin ninguna duda.
- **En contra:** a 48 px el relojito se convierte en una mancha naranja; se pierden las
  agujas. Queda legible como "L con una marca naranja", que sigue siendo señal de familia,
  pero pierde lo que quería decir.

### B — Las nueve en punto

Una esfera de reloj con el trazo modulado de un serif: el anillo es más grueso a los
costados y más fino arriba y abajo, como la panza de una "O" de Playfair. La aguja de la
hora en naranja, marcando las 9.

- **A favor:** la más limpia a 48 px. Cero riesgo de confundirse con otra app.
- **En contra:** no dice "mensajes". Parece una app de alarmas. La modulación del trazo,
  que es lo que la emparenta con la familia, casi no se percibe a tamaño chico.

### C — La burbuja y la hora

Una burbuja de diálogo con las agujas adentro marcando las 9, la hora en naranja.

- **A favor:** dice las dos cosas —mensajes y momento— y aguanta bien a 48 px. Conserva la
  firma de la familia por el degradado y el par tinta/acento.
- **En contra:** es la menos typográfica de las tres; el parentesco viene del color y el
  fondo, no de la forma.

## Recomendación

**C.** Es la única que comunica qué hace la app y además sobrevive al tamaño real. B es
más linda pero muda, y A pierde justo el detalle que la hacía interesante.

Si el parentesco visual pesa más que la claridad, A es la respuesta — pero entonces
convendría agrandar el reloj y sacarle las agujas, dejando un círculo con un punto.

## Antes de dar por cerrado

- [ ] Mirarlas en el teléfono, al lado del icono de Pipí Cucú.
- [ ] Generar el adaptive icon de Android respetando la zona segura: el sistema recorta el
      borde con máscaras distintas según el fabricante, así que todo lo importante tiene
      que vivir en el 66 % central.
- [ ] Exportar los tamaños que piden las tiendas y declararlos en `app.json`.
