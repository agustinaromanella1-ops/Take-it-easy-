# Icono de la app — direcciones visuales y prompt de generación

## Restricciones que cualquier opción tiene que cumplir

Estas no son preferencias estéticas, son requisitos técnicos y legales:

1. **Tiene que leerse a 48 px.** Es el tamaño real en el cajón de apps. Si el concepto
   necesita detalle fino, no sirve. Prueba: achicá la imagen a 48 px y miralo. Si dudás de
   qué es, descartalo.
2. **No puede parecerse a WhatsApp.** Nada de auricular de teléfono blanco sobre burbuja
   verde, y nada del verde `#25D366`. Es riesgo de rechazo en la tienda y de marca.
   Tampoco avioncito de papel azul: ese es Telegram.
3. **Android adaptive icon:** el sistema recorta con máscaras distintas según el fabricante
   (círculo, squircle, cuadrado redondeado). Todo lo importante tiene que vivir en el
   **66 % central** de la imagen. El ~18 % del borde se puede perder.
4. **iOS:** 1024×1024, cuadrado, **sin transparencia y sin esquinas redondeadas propias**.
   El sistema aplica la máscara solo.
5. **Sin texto.** Ni letras ni números: a 48 px no se leen, y los generadores de imagen los
   escriben mal.

## Paleta de la app

| Rol | Hex |
|---|---|
| Verde profundo (acento) | `#0F7A5F` |
| Crema (fondo claro) | `#FBF8F4` |
| Verde menta (burbuja) | `#DCF3E4` |
| Verde claro (acento oscuro) | `#4FCFA6` |
| Casi negro (texto) | `#1B1815` |

Nota sobre el verde: `#0F7A5F` es profundo y apagado, bastante lejos del verde brillante de
WhatsApp. Aun así, **una burbuja verde sobre fondo blanco leería como WhatsApp**. Por eso
las tres direcciones invierten la relación: forma clara sobre fondo verde profundo.

---

## Dirección A — La burbuja en pausa

Una burbuja de chat en crema sobre fondo verde profundo. Adentro, en vez de los tres
puntitos del "escribiendo…", las agujas de un reloj.

- **Dice:** mensajes + tiempo. Se entiende en menos de un segundo.
- **A favor:** máxima legibilidad de categoría. Cualquiera entiende que es de mensajería.
- **En contra:** es el concepto más obvio; hay otras apps de recordatorios parecidas.
  La inversión crema-sobre-verde es lo que la salva de parecer WhatsApp — si la hacés
  verde sobre blanco, se arruina.

## Dirección B — Las nueve en punto

Sin burbuja. Solo una esfera de reloj mínima y geométrica, marcando las 9:00 — la hora
firma de la app, la de "mañana a las 9". Crema sobre verde profundo.

- **Dice:** el momento justo. Calma, precisión.
- **A favor:** cero riesgo de confusión con nadie. Impecable a 48 px. Es la que mejor
  envejece y la que más va con el nombre y el tono de la app.
- **En contra:** no comunica "mensajes". Parece una app de alarmas o recordatorios.
  Necesita que el nombre al lado haga ese trabajo.

## Dirección C — El mensaje que espera su hora

La silueta de una burbuja de chat construida con las marcas horarias de un reloj: los
doce tiquecitos del dial dispuestos siguiendo el contorno de la burbuja, con un punto
sólido marcando una posición (el momento elegido).

- **Dice:** un mensaje guardado para un momento específico. Es el concepto más fiel a lo
  que la app realmente hace.
- **A favor:** el más original y con más personalidad. Difícil de confundir con otra app.
- **En contra:** el más arriesgado a tamaño chico — si los tiquecitos son muy finos, a
  48 px se convierte en una mancha. Requiere ajuste fino de grosores.

---

## Recomendación

**Dirección A**, ejecutada en crema sobre verde profundo.

El razonamiento: en una pantalla llena de iconos, el reconocimiento de categoría gana. La B
es más linda y más "de marca", pero un usuario que la ve por primera vez no sabe qué hace.
La C es la más interesante conceptualmente pero es la que más chances tiene de fallar en el
único tamaño que importa.

La A con la inversión de color resuelve el problema de WhatsApp y conserva la legibilidad.
Si querés algo con más carácter una vez que la app esté andando, la C es a dónde crecer.

---

## Prompt para generar la imagen

Pegá esto en ChatGPT. El bloque **CONCEPTO** es lo único que cambia entre las tres
direcciones — copiá el que quieras probar.

```
Diseñá un icono de app móvil. Imagen cuadrada de 1024×1024 píxeles.

CONCEPTO:
[PEGAR ACÁ UNO DE LOS TRES BLOQUES DE ABAJO]

ESTILO:
- Vectorial plano y geométrico. Formas simples y limpias, bordes nítidos.
- Sin gradientes, sin sombras, sin brillos, sin efectos 3D, sin texturas.
- Un solo color de fondo, plano y sólido, cubriendo toda la imagen.
- Trazos gruesos y parejos. Nada de líneas finas ni detalle pequeño.
- Estética calma y cálida, no corporativa ni tecnológica.

COLORES (usá exactamente estos):
- Fondo: verde profundo #0F7A5F
- Forma principal: crema #FBF8F4
- Acento opcional, con moderación: verde menta #DCF3E4

COMPOSICIÓN:
- El elemento principal centrado, ocupando aproximadamente el 60% del ancho.
- Margen amplio y parejo en los cuatro lados: el borde exterior se va a recortar.
- Simétrico y equilibrado.

NO INCLUIR:
- Nada de texto, letras ni números.
- Nada de auricular de teléfono ni verde brillante estilo WhatsApp (#25D366).
- Nada de avión de papel azul estilo Telegram.
- Sin esquinas redondeadas ni máscara: cuadrado completo, el sistema la aplica después.
- Sin transparencia, sin fondo a cuadros, sin marco, sin borde.
- Sin sombra paralela ni reflejos.

Generame 4 variaciones distintas del mismo concepto.
```

### Bloque CONCEPTO — Dirección A

```
Una burbuja de diálogo de chat, en crema, centrada sobre el fondo verde.
La burbuja es redondeada, de forma simple, con una colita corta abajo a la
derecha. Dentro de la burbuja, en lugar de los tres puntos suspensivos
habituales, hay dos agujas de reloj en verde profundo que parten del centro
y marcan las nueve en punto. Las agujas son gruesas y de puntas redondeadas.
```

### Bloque CONCEPTO — Dirección B

```
La esfera de un reloj analógico minimalista, en crema, centrada sobre el
fondo verde. Un círculo de contorno grueso, con dos agujas gruesas de puntas
redondeadas que marcan las nueve en punto. Solo cuatro marcas horarias
cortas en las posiciones de las 12, 3, 6 y 9. Sin números, sin segundero.
Geométrico y sereno.
```

### Bloque CONCEPTO — Dirección C

```
La silueta de una burbuja de diálogo de chat sugerida por marcas horarias de
reloj: doce tiquecitos cortos y gruesos, en crema, dispuestos siguiendo el
contorno de una burbuja redondeada con una colita abajo a la derecha. La
forma de la burbuja se percibe por la disposición de los tiquecitos, no por
una línea continua. Uno de los tiquecitos, arriba a la derecha, es un punto
sólido más grande en verde menta, marcando un momento elegido. El centro
queda vacío.
```

---

## Después de generar

1. **Achicá cada variante a 48 px** y mirala. Es la única prueba que importa.
2. Probala sobre un fondo de pantalla claro y uno oscuro.
3. Lo que salga va a ser un PNG con bordes suaves y geometría imprecisa: los generadores
   de imagen no producen vectores reales. Sirve para **elegir la dirección**, no como
   archivo final. El icono definitivo hay que redibujarlo como SVG y de ahí exportar los
   tamaños que piden las tiendas.
