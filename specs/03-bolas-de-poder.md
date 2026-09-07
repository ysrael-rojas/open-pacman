# SPEC 03 — Bolas de poder y fantasmas asustados

> **Estado:** Aprobado
> **Depende de:** SPEC 01, SPEC 02
> **Fecha:** 2026-09-07
> **Objetivo:** Añadir las 4 bolas de poder clásicas en las esquinas: al comerlas
> los fantasmas liberados se asustan (azules, lentos, comestibles) y al ser
> comidos regresan como ojos a la pen para regenerarse.

## Por qué existe esta spec

SPEC 01 y 02 dejaron explícitamente fuera las bolas de poder y el modo asustado.
Esta spec implementa el ciclo completo del arcade: bola → azul → comer fantasma
→ ojos que vuelven a la pen → regeneración. Es la pieza que convierte a los
fantasmas de amenaza a presa y no se parte en dos porque un fantasma azul que no
se puede comer solo sería "inofensivo", lo que no es el juego clásico.

## Scope

**In:**

- 4 bolas de poder en las celdas (1,3), (26,3), (1,23) y (26,23), que sustituyen
  al dot actual de cada celda. Valen 50 pts y cuentan para el total a comer
  (no se gana la partida dejándolas sin comer).
- Al comer una bola: temporizador de asustado a 6 s (360 frames). Los fantasmas
  `released` que están **fuera de la pen** invierten su dirección, pasan a modo
  `frightened` (azul oscuro, velocidad 0.05, deambulan al azar).
- Los no liberados que esperan en la pen no se ven afectados; si uno se libera
  mientras el azul sigue activo, se incorpora asustado al salir (sin invertir).
- Comer otra bola con asustado activo reinicia el temporizador a 6 s y resetea
  la secuencia de puntos a 200.
- Últimos 2 s (120 frames) del asustado: parpadeo blanco/azul como aviso.
- Un fantasma `frightened` es comestible: 200/400/800/1600 pts según los
  comidos durante el mismo energizador (200 el primero tras cada bola).
- Al comerlo pasa a modo `eyes`: solo ojos, a doble velocidad, cruzando la
  puerta hacia dentro (excepción a la regla de SPEC 02). Al llegar a su celda
  de origen espera 1 s (60 frames) y sale de nuevo como fantasma normal.
- Al perder una vida o reiniciar partida, todo se resetea: modos, temporizador,
  secuencia y velocidades.

**Out of scope (para futuras specs):**

- Reducción de duración del asustado por nivel o niveles en los que ya no se
  vuelven azules (no hay progresión de niveles en este repo).
- Subir la velocidad de Pac-Man durante el asustado (nivel 1 del arcade).
- Fase *scatter* global y modos de alternancia scatter/chase.
- Audio, sonidos o sprites nuevos (los ojos se dibujan con primitivas).
- Modo ojos "vivo" sin ser comido (regreso voluntario a la pen).

## Data model

```js
// maze.js — tile 4 = bola de poder. Las celdas se marcan con 'o' en MAZE_STR
// (4 dots se convierten en bolas; nada más cambia):
//   fila 3 : col 1 y col 26  -> '#o####.#####.##.#####.####o#'
//   fila 23: col 1 y col 26  -> '#o..##................##..o#'
// parseTile( 'o' ) => 4
```

```js
// game.js — constantes nuevas
const ENERGY_SCORE = 50;    // pts por bola
const GHOST_EAT_BASE = 200; // pts 1er fantasma comido tras una bola
const FRIGHT_TIME = 360;    // 6 s de asustado (60 fps)
const FLICKER_TIME = 120;   // parpadeo en los últimos 2 s
const FRIGHT_SPEED = 0.05;  // mitad del 0.1 base
const EYES_SPEED = 0.2;     // el doble del 0.1 base (ojos clásicos)
const REVIVE_DELAY = 60;    // espera de 1 s dentro de la pen al regenerar
```

```js
// game.js — estado de la partida (createGame)
{
  frightTimer: 0,   // frames restantes de asustado; 0 = inactivo
  ghostChain: 0,    // fantasmas comidos desde la última bola
}

// game.js — por fantasma (se añade a cada objeto de game.ghosts)
{
  mode: 'normal',   // 'normal' | 'frightened' | 'eyes'
  // speed se cambia en cada transición:
  //   normal -> chaser ? 0.125 : 0.1  |  frightened -> 0.05  |  eyes -> 0.2
}
```

Reglas:

- `activateFrighten( game )`: `frightTimer = FRIGHT_TIME`, `ghostChain = 0`; a
  cada fantasma con `mode === 'normal' && released && !insidePen` le aplica
  `dir = OPPOSITE[ dir ]`, `mode = 'frightened'` y `speed = FRIGHT_SPEED`.
- Cada frame en `update`: si `frightTimer > 0`, se decrementa; al llegar a 0
  todos los `frightened` vuelven a `normal` con su velocidad de `kind`.
- Si un fantasma pasa a `released` y queda fuera de la pen con `frightTimer > 0`
  y `mode === 'normal'`, se incorpora asustado **sin invertir** dirección.
- `decideGhost` gana dos ramas tempranas: `eyes` → objetivo = su celda de
  origen en `GHOST_STARTS`; `frightened` → `target = null` (deambula al azar,
  igual que los no liberados hoy). Las estrategias de `kind` no aplican.
- Puerta: `blocksDoor( g )` pasa a devolver `false` cuando `g.mode === 'eyes'`
  (los ojos cruzan la puerta hacia dentro; única excepción a SPEC 02).
- Colisión (en `update`): `eyes` → nada; `frightened` → comer
  (`score += GHOST_EAT_BASE * 2 ** ghostChain`, `ghostChain++`, pasa a `eyes`
  con `speed = EYES_SPEED`); `normal` → perder vida (regla previa intacta).
- Al alinear en su celda de origen: `mode = 'normal'`, `released = false`,
  `waitFrames = REVIVE_DELAY`; sale después por la mecánica de SPEC 01/02.
- `resetPositions`: restaura `mode`, `speed` y también `frightTimer = 0` y
  `ghostChain = 0`. `dotsRemaining` cuenta celdas 2 y 4.

## Implementation plan

Cada paso deja el juego ejecutable en el navegador (`src/index.html`).

1. **Bolas en el laberinto y comida (+50).** En `src/js/maze.js` sustituir los 4
   dots por `o` (filas 3 y 23, cols 1 y 26) y añadir `'o' -> 4` en `parseTile`.
   En `src/js/game.js`: `createGame` cuenta `dotsRemaining` con celdas `2` y `4`;
   en `movePacman`, al alinear en celda `4` sumar `ENERGY_SCORE`, vaciar la celda
   y decrementar `dotsRemaining` (rama separada de la del dot). En
   `src/js/render.js`, `drawDots` dibuja el tile `4` como círculo grande
   (radio ~5) con pulsación según `frame`. Verificación: se ven 4 bolas grandes
   cerca de las esquinas; comerlas suma 50 y desaparecen; no se gana hasta
   comérselas todas; los fantasmas se comportan igual que antes.
2. **Modo asustado.** En `game.js` añadir `mode` por fantasma, `frightTimer` y
   `ghostChain` a `createGame`; `activateFrighten( game )` con inversión de
   dirección solo para liberados fuera de la pen; decremento de `frightTimer` en
   `update` con vuelta a `normal` al agotarse; incorporación asustada del
   fantasma que se libera durante el azul (sin inversión); `decideGhost` con
   rama `frightened` (deambula). En `render.js`, `drawGhost` pinta el cuerpo azul
   oscuro `#2121ff` cuando `mode === 'frightened'`. Verificación: al comer una
   bola los liberados que están fuera invierten, se vuelven azules, van más
   lento y deambulan; los de la pen no cambian; a los ~6 s recuperan color,
   velocidad y estrategia; un fantasma que sale durante el azul se incorpora
   azul.
3. **Parpadeo de aviso.** En `render.js`, pasar `frame` y `frightTimer` a
   `drawGhost`: si `frightened` y `frightTimer <= FLICKER_TIME`, alternar cuerpo
   blanco/azul cada ~6 frames. Verificación: en los últimos ~2 s del asustado
   los fantasmas parpadean antes de volver a la normalidad.
4. **Comer fantasmas y ojos a la pen.** En `game.js`: colisión según `mode`
   (comer/ignorar/perder vida), puntuación 200·2ⁿ, transición a `eyes` con
   `EYES_SPEED`, rama `eyes` en `decideGhost` con objetivo la celda de origen y
   `blocksDoor( g ) === false` para ojos; al llegar a su celda, espera
   `REVIVE_DELAY` y regeneración normal; `resetPositions` restaura modos,
   temporizador, secuencia y velocidades. En `render.js`, dibujar modo `eyes`
   como solo los dos ojos blancos con pupilas mirando a `dir`. Verificación:
   comer fantasmas azules suma 200/400/800/1600; al comerlos quedan los ojos,
   cruzan la puerta hacia la pen y el regenerado sale ~1 s después; chocar con
   ojos no resta vida; perder una vida resetea todo.

## Acceptance criteria

- [ ] Hay 4 bolas de poder visibles, más grandes que los dots, en las celdas
      (1,3), (26,3), (1,23) y (26,23).
- [ ] Comer una bola suma exactamente 50 pts al marcador y la bola desaparece.
- [ ] No se gana la partida mientras quede una bola sin comer.
- [ ] Al comer una bola, los fantasmas liberados que están fuera de la pen
      invierten su dirección, se vuelven azul oscuro y deambulan a ~0.05
      celda/frame.
- [ ] Los fantasmas que aún esperan en la pen no cambian de color ni invierten
      mientras esperan.
- [ ] Un fantasma que se libera durante un asustado activo sale ya azul (sin
      inversión al salir).
- [ ] A los ~6 s (±1 s) del asustado los fantasmas recuperan su color, su
      velocidad y su estrategia de persecución.
- [ ] En los últimos ~2 s del asustado los fantasmas parpadean en blanco/azul
      antes de volver a la normalidad.
- [ ] Comer otra bola durante un asustado activo reinicia el temporizador a 6 s
      y la secuencia de puntos a 200.
- [ ] Chocar con un fantasma asustado lo "come": suma 200 pts (el primero tras
      cada bola) y quedan solo sus ojos; los siguientes valen 400, 800 y 1600.
- [ ] Los ojos se dirigen a la pen, cruzan la puerta hacia dentro y, tras ~1 s
      de espera en su celda de origen, el fantasma regenerado sale a perseguir.
- [ ] Chocar con un fantasma normal cuesta una vida (regla previa intacta) y
      chocar con unos ojos no resta vida.
- [ ] Al perder una vida se resetean posiciones, modos de fantasmas,
      temporizador de asustado y secuencia de puntos.
- [ ] No hay errores en la consola del navegador.

## Decisions

- **Sí:** una sola spec con el ciclo completo. Comer un azul y los ojos/regeneración están acoplados; partirlo dejaría un "asustado inofensivo pero no comestible", ajeno al arcade. (Decisión del usuario.)
- **Sí:** celdas (1,3), (26,3), (1,23), (26,23). Son dots actuales, simétricas en columnas y replican la colocación del arcade en esta geometría. **No:** los dots pegados a los bordes (1,1)/(26,1)/(1,29)/(26,29), lectura más literal pero menos fiel. (Decisión del usuario.)
- **Sí:** bola como tile numérico `4` parseado de `o`, en la propia matriz. Encaja con el parseo actual, se copia con la partida y evita estructuras paralelas. `dotsRemaining` cuenta `2` y `4` (en el arcade hay que comerse las bolas para limpiar el tablero).
- **Sí:** números del arcade (nivel 1): bola 50 pts, asustado 6 s (360 frames), parpadeo los últimos 2 s, velocidad asustada 0.05, ojos 0.2, secuencia 200/400/800/1600. (Decisión del usuario.)
- **Sí:** se asustan solo los liberados que están fuera de la pen en el momento de comer la bola; los que esperan dentro no se ven afectados. (Decisión del usuario.)
- **Sí:** un fantasma que se libera durante un asustado activo se incorpora azul al salir, sin inversión. Replica el modo global del arcade y evita que un fantasma "normal" cruce la zona azul matando a Pac-Man en pleno efecto. (Decisión del usuario.)
- **Sí:** comer otra bola con asustado activo reinicia el temporizador a 6 s y la secuencia a 200. (Decisión del usuario.)
- **Sí:** los ojos cruzan la puerta hacia dentro como excepción a la regla de un solo sentido de SPEC 02 (`blocksDoor` devuelve `false` para `mode === 'eyes'`). Es la única vía clásica de reentrada.
- **Sí:** regeneración con espera de 1 s reutilizando `released`/`waitFrames` de SPEC 01/02 (el fantasma revive y sale por la mecánica existente).
- **No:** subir la velocidad de Pac-Man durante el asustado ni reducir la duración por nivel (no hay progresión de niveles en este repo).
- **No:** scatter global, audio ni sprites nuevos; los ojos se dibujan con las primitivas actuales.
- **No:** hacer que la velocidad dependa del número de frames de espera de entrada/salida del túnel (regla del arcade que no existe en este repo).

## Risks

| Riesgo | Mitigación |
| ------ | ---------- |
| Los 6 s se miden en frames (360 a 60 fps) y en monitores de alta frecuencia el asustado se acorta | Coherente con el resto del juego (frame-based); los demás temporizadores ya lo asumen. Se documenta en los comentarios de `game.js`. |
| Al permitir a los ojos cruzar la puerta, un ojo podría atravesarla también hacia fuera tras regenerarse | La regeneración ocurre al alinear en la celda de origen (dentro de la pen) y cambia `mode` a `normal`; en `normal` aplica la puerta de SPEC 02. Verificación en la prueba manual. |
| Fantasma comido cuando `frightTimer` termina en el mismo frame | La colisión se evalúa con el modo del fantasma antes de decrementar el temporizador; el modo `frightened` del frame anterior es el que decide. |
| Un fantasma asustado atrapado en un callejón (sin giro de 180) se queda quieto hasta recuperar su estrategia | Es la misma mecánica de "sin salida" de los fantasmas actuales; breve y aceptable, se observa en la prueba manual. |
| Comer varias bolas seguidas y luego varios fantasmas puede superar la cuenta de la secuencia | Solo hay 4 fantasmas, así que 200·2ⁿ tope práctico en 1600; el `ghostChain` se resetea con cada bola. |

## Qué **no** está en esta spec

- Duración del asustado variable por nivel ni niveles donde ya no se vuelven azules.
- Aumento de velocidad de Pac-Man durante el asustado.
- Fase *scatter* global por oleadas.
- Audio, efectos de sonido o sprites nuevos.
- Ojos que regresan a la pen sin haber sido comidos.

Cada una de esas, si llega, va en su propia spec.
