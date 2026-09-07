# SPEC 01 — Cuatro fantasmas con estrategias propias

> **Estado:** Aprovado
> **Depende de:** ninguna
> **Fecha:** 2026-09-07
> **Objetivo:** Tener 4 fantasmas en la partida, cada uno con una estrategia de
> movimiento propia (una agresiva hacia Pac-Man), salida escalonada de la pen y
> color clásico que lo identifica.

## Por qué existe esta spec

Hoy solo hay 2 fantasmas (`hunter` y `random` en `src/js/maze.js:54`) y apenas se distinguen jugando. Esta spec los sustituye por 4 arquetipos con comportamientos observables y añade la mecánica de salida escalonada de la pen.

## Scope

**In:**

- 4 fantasmas con `kind`: `chaser` (agresivo), `ambusher`, `flanker` y `shy`, cada uno con función de decisión propia en `decideGhost()` (`src/js/game.js`).
- Salida escalonada de la pen con retrasos 0s / 4s / 8s / 12s; los no liberados se mueven dentro de la pen sin cruzar la puerta `-` (tile 3).
- Velocidad por `kind`: perseguidor 0.125 celda/frame (igual que Pac-Man), resto 0.1.
- Color clásico por `kind`: rojo, rosa, cian, naranja (mapa en `render.js`, no por índice).
- El `flanker` usa la posición del `chaser` para calcular su objetivo.
- Al perder una vida (`resetPositions`) y al reiniciar partida se repite la secuencia completa de salida.

**Out of scope (para futuras specs):**

- Bolas de poder / energizers, modo "asustado" (fantasmas azules comestibles) y modo ojos que regresan a la pen.
- Fase *scatter* global periódica del arcade (todos a sus esquinas por oleadas).
- Aumento de velocidad del perseguidor según puntos restantes.
- Fantasmas que deciden mirando más de una celda a futuro (pathfinding).
- Sprites/animaciones nuevas (los fantasmas se dibujan como hoy, solo cambia el color).

## Data model

```js
// maze.js — celda, rol y retraso de salida de cada fantasma
const GHOST_STARTS = [
  { x: 14, y: 13, kind: 'chaser',   releaseDelay: 0 },
  { x: 13, y: 13, kind: 'ambusher', releaseDelay: 4 },
  { x: 14, y: 15, kind: 'flanker',  releaseDelay: 8 },
  { x: 13, y: 15, kind: 'shy',      releaseDelay: 12 },
];

// game.js — velocidades
const PACMAN_SPEED = 0.125;
const GHOST_SPEED = 0.1;           // ambusher, flanker, shy
const GHOST_SPEED_CHASER = 0.125;  // chaser: igual que pacman
```

Cada fantasma en `createGame()` se crea así:

```js
{
  x, y, dir: 'up', kind, speed,
  released: releaseDelay === 0,
  waitFrames: Math.round( releaseDelay * 60 ), // frames -> segundos
}
```

```js
// render.js — color por rol (inmune a reordenaciones)
const GHOST_COLOR = {
  chaser: '#ff0000',    // rojo
  ambusher: '#ffb8ff',  // rosa
  flanker: '#00ffff',   // cian
  shy: '#ffb852',       // naranja
};
```

Estrategias (todas eligen entre los vecinos válidos sin volver atrás; si no hay salida, se permite el giro de 180 como hoy):

- `chaser`: minimiza distancia Manhattan hasta la celda de Pac-Man.
- `ambusher`: minimiza distancia hasta la celda `2` celdas por delante de Pac-Man según su dirección (si no es transitable, cae a la celda de Pac-Man).
- `flanker`: calcula el punto 2 celdas por delante de Pac-Man y lo refleja respecto a la celda actual del `chaser` (`target = 2 * porDelante - chaser`); minimiza distancia hasta ese punto.
- `shy`: si la distancia Manhattan a Pac-Man es > 8 celdas, persigue como `chaser`; si es ≤ 8, elige al azar (vaga).

## Implementation plan

Cada paso deja el juego ejecutable en el navegador (`src/index.html`).

1. **Cuatro fantasmas con estrategias propias (sin retraso aún).** En `src/js/maze.js` sustituir `GHOST_STARTS` por las 4 entradas anteriores. En `src/js/game.js`: `createGame` asigna a cada fantasma `kind` y `speed` según rol; `decideGhost` renombra `hunter` → `chaser` e implementa los 4 handlers (`chaser`, `ambusher`, `flanker` —buscando al `chaser` en `game.ghosts`—, `shy`; por defecto aleatorio). Verificación: se ven 4 fantasmas moviéndose y el rojo es visiblemente más rápido.
2. **Contención y salida escalonada.** En `game.js`, alineado en celda: si `!released`, se decrementa `waitFrames` y la decisión trata la puerta (tile 3) como pared para que el fantasma rebote dentro de la pen; al llegar a 0 pasa a `released: true` y decide con las reglas normales. `resetPositions` restaura posición, `dir: 'up'`, `released` y `waitFrames` desde `GHOST_STARTS`. Verificación: al empezar solo sale el rojo; el resto rebota en la pen y sale a los ~4/8/12 s; perder una vida repite la secuencia.
3. **Color por rol en render.** En `src/js/render.js` sustituir `GHOST_COLORS[ i ]` por el mapa `GHOST_COLOR[ g.kind ]` (con fallback rojo). Verificación: colores clásicos estables aunque se reordene `GHOST_STARTS`.

## Acceptance criteria

- [ ] Al iniciar partida hay 4 fantasmas, cada uno con un color clásico distinto (rojo, rosa, cian, naranja).
- [ ] El Perseguidor (rojo) es el único que sale de la pen al instante y se mueve a 0.125 celda/frame (igual que Pac-Man).
- [ ] El Emboscador (rosa) sale ~4 s después y en pasillos rectos tiende a colocarse por delante de la dirección de Pac-Man.
- [ ] El Flanqueador (cian) sale ~8 s después y se aproxima por una trayectoria distinta a la recta hacia Pac-Man.
- [ ] El Tímido (naranja) sale ~12 s después: persigue cuando Pac-Man está lejos y vaga cuando se le acerca.
- [ ] Mientras no se liberan, los fantasmas se mueven dentro de la pen sin cruzar la puerta `-`.
- [ ] Al perder una vida todos vuelven a sus celdas de la pen y la secuencia 0/4/8/12 s se repite.
- [ ] Al reiniciar partida (ganar o perder) la secuencia de salida se reinicia.
- [ ] Ningún fantasma atraviesa paredes y ninguno hace giro de 180° salvo en callejón sin salida (reglas previas intactas).
- [ ] No hay errores en la consola del navegador.

## Decisions

- **Sí:** arquetipos del arcade (`chaser`/`ambusher`/`flanker`/`shy`). Cada uno es reconocible al jugar y verificable por separado.
- **Sí:** salida escalonada 0/4/8/12 s con los no liberados rebotando dentro de la pen (no quietos), para que la pen se vea viva.
- **Sí:** el `flanker` depende de la posición del `chaser`. Es la diferencia visible clave con el `chaser`; el costo es una referencia cruzada en `decideGhost`.
- **Sí:** velocidad del perseguidor a 0.125, resto a 0.1. **No:** subir la velocidad del perseguidor a mitad de partida como el arcade (se difiere).
- **Sí:** color por `kind` con mapa en `render.js`, no por índice como hoy.
- **Sí:** identificadores de rol en inglés (`chaser`, `ambusher`, `flanker`, `shy`), comentarios en español, coherente con `hunter`/`random` actuales.
- **No:** modo scatter global periódico, bolas de poder ni modo asustado — amplían demasiado el alcance y van a otra spec.
- Nota: definición rápida sin preguntar por cada detalle cosmético; el comportamiento observable es el contrato.

## Risks

| Riesgo | Mitigación |
| ------ | ---------- |
| Un fantasma liberado puede volver a entrar a la pen y orbitar la puerta | No prohíbe la reentrada en esta spec; se observa en la prueba manual y, si molesta, se cierra con una regla "no volver a la pen" en otra spec. |
| Salida congestionada: 3 fantasmas liberados se acumulan en la puerta de 2 celdas | No hay colisión fantasma-fantasma y el mecanismo de giro de 180° los desatasca; verificación manual de que los 4 terminan saliendo. |
| Los retrasos se miden en frames (60 fps) y en monitores de alta frecuencia los 4/8/12 s se acortan | Coherente con el resto del juego, que ya es frame-based; se documenta en los comentarios de `game.js`. |

## Qué **no** está en esta spec

- Bolas de poder, fantasmas comestibles (modo asustado) y modo ojos.
- Fase scatter global por oleadas.
- Velocidad dinámica del perseguidor.
- Pathfinding de más de una celda.
- Reentrada prohibida a la pen.

Cada una de esas, si llega, va en su propia spec.
