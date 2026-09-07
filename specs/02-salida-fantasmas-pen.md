# SPEC 02 — Salida fiable de los fantasmas de la pen

> **Estado:** Implementado
> **Depende de:** SPEC 01
> **Fecha:** 2026-09-07
> **Objetivo:** Arreglar la salida de los fantasmas de la pen para que cada uno
> salga al cumplirse su retraso (0/4/8/12 s) sin depender de Pac-Man, patrullen
> dentro de la jaula mientras esperan y no puedan reentrar una vez fuera.

## Por qué existe esta spec

Tras SPEC 01 los fantasmas que esperan su turno siguen dirigiendo su estrategia
hacia objetivos externos a la pen (`decideGhost` aplica el `kind` aunque
`!released`). Como la puerta (fila 12, tiles `-`) les bloquea, se pegan a la
pared de la pen más cercana a su objetivo — normalmente el borde inferior de la
puerta — y oscilan de izquierda a derecha sin salir. Como los retrasos llegan a
12 s, la salida coincide visualmente con la primera vez que Pac-Man sube por
encima de la jaula, y parece depender de su posición (no es así: depende solo
del reloj de `waitFrames`). Además, la puerta es hoy de doble sentido: un
liberado puede volver a entrar y orbitar dentro de la pen (se reproduce en
simulación: a los ~15 s los 4 fantasmas vuelven a estar dentro).

## Scope

**In:**

- Mientras un fantasma no está liberado, deambula al azar por el interior de la
  pen (sin aplicar la estrategia de su `kind`) y nunca cruza la puerta.
- La salida de cada fantasma ocurre solo al cumplirse su retraso (reloj de
  frames 0/4/8/12 s), sin depender de la posición de Pac-Man.
- Puerta de un solo sentido: un liberado que ya está fuera de la pen ve la
  puerta como pared (sale pero no reentra). Un liberado que sigue dentro la
  cruza hacia fuera con normalidad.
- Los resets (perder una vida / reiniciar partida) siguen teletransportando a
  todos a la pen y repitiendo la espera, como en SPEC 01.

**Out of scope (para futuras specs):**

- Colocar a los fantasmas fuera de la pen al iniciar (eliminar la espera).
- Modo ojos que regresa a la pen tras ser comido (depende del modo asustado).
- Cambios en las estrategias de persecución una vez fuera de la pen.
- Pathfinding, colisiones fantasma-fantasma, colores o tiempos nuevos.

## Data model

Esta spec no introduce estructuras nuevas. Reutiliza `GHOST_STARTS`, los campos
`released` / `waitFrames` del fantasma y las constantes `PEN`, `DOOR_ROW` y
`DOOR_COLS` (`src/js/game.js`). Solo añade un criterio (función auxiliar, no un
dato):

```js
// game.js — la puerta bloquea a quien no está liberado o ya está fuera de la pen
function blocksDoor( g ) {
  return !g.released || !insidePen( g.x, g.y );
}
```

## Implementation plan

Cada paso deja el juego ejecutable en el navegador (`src/index.html`).

1. **Patrulla dentro de la pen.** En `src/js/game.js`, `decideGhost`: mientras
   `!g.released`, no aplicar la estrategia del `kind` y dejar `target = null`
   (deambula al azar entre vecinos válidos, igual que vaga el `shy` hoy). La
   cuenta atrás de `waitFrames` y la salida escalonada no cambian. Verificación:
   al iniciar solo sale el rojo; rosa/cian/naranja recorren el interior de la
   pen (filas 13–15, cols 11–16) sin quedarse pegados bajo la puerta.
2. **Puerta de un solo sentido.** En `game.js`, sustituir el `!g.released` que
   se pasa hoy a `canMove` (en las `options` de `decideGhost`), al chequeo
   `isWall` del objetivo del `ambusher`, y al `canMove` posterior de
   `moveGhost`, por el criterio `blocksDoor( g )` de arriba. Verificación: tras
   salir los 4 y con Pac-Man quieto bajo la pen, ninguno vuelve a entrar; si un
   liberado quiere a Pac-Man al otro lado de la pen, rodea por los laterales.

## Acceptance criteria

- [ ] Al iniciar la partida (y tras cada reset por vida perdida) el chaser rojo
      sale de la pen en <1 s sin que Pac-Man se mueva.
- [ ] Con Pac-Man en la parte baja (sin acercarlo a la pen), rosa/cian/naranja
      salen igualmente a los ~4/8/12 s (±1 s): la salida no depende de la
      posición de Pac-Man.
- [ ] Mientras esperan su turno, los no liberados se mueven por el interior de
      la pen (cols 11–16, filas 13–15) y no permanecen pegados ni oscilando en
      las celdas de la entrada bajo la puerta.
- [ ] Ningún fantasma no liberado cruza la fila de la puerta, ni siquiera
      "persiguiendo" su objetivo.
- [ ] Una vez fuera, ningún fantasma liberado vuelve a entrar a la pen: con
      Pac-Man al otro lado de la pen, rodean por los laterales en vez de cruzar
      la puerta hacia abajo.
- [ ] Al perder una vida todos vuelven a sus celdas de la pen y la secuencia
      0/4/8/12 s se repite (regla de SPEC 01 intacta).
- [ ] Fuera de la pen las estrategias siguen igual (chaser agresivo, etc.), sin
      giros de 180° salvo en callejón sin salida y sin atravesar paredes.
- [ ] No hay errores en la consola del navegador.

## Decisions

- **Sí:** deambular al azar para los no liberados en lugar de dirigirse a su
  objetivo externo. Evita que se apilen en la entrada y mantiene la pen viva
  (intención original de SPEC 01).
- **Sí:** puerta de un solo sentido implementada como "la puerta bloquea a todo
  fantasma que no esté liberado o que ya esté fuera de la pen". Es local, no
  cambia geometría ni datos.
- **Sí:** la salida depende solo del reloj de `waitFrames`. **No:** atarla a la
  posición de Pac-Man ni gatillarla cuando Pac-Man se aleja.
- **No:** eliminar la espera escalonada ni reubicar los puntos iniciales fuera
  de la pen (el usuario eligió conservar el diseño de SPEC 01).
- **No:** tocar `render.js` ni `main.js` (no cambia lo visual).

## Risks

| Riesgo | Mitigación |
| ------ | ---------- |
| Con la puerta cerrada, un liberado que persigue a Pac-Man al otro lado de la pen da un rodeo mayor y puede oscilar en el camino (sin pathfinding) | Ya es el comportamiento previo de SPEC 01; se observa en la prueba manual y, si molesta, se ataca con pathfinding simple en otra spec. |
| El deambular aleatorio dentro de la pen puede producir ping-pong corto entre 2 celdas | Cosmético y breve; misma mecánica que el modo vago del `shy`; se acepta. |
| El reset por vida perdida teletransporta a liberados de vuelta a la pen | No contradice la puerta de un solo sentido (es reubicación, no cruce); verificar en la prueba manual que siguen saliendo tras el reset. |

## Qué **no** está en esta spec

- Eliminar la espera escalonada ni colocar a los fantasmas en el mapa al iniciar.
- Modo ojos / regreso a la pen tras ser comido.
- Cambios en estrategias, pathfinding, colisiones fantasma-fantasma o retoques
  visuales.

Cada una de esas, si llega, va en su propia spec.
