// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

const PACMAN_SPEED = 0.125;      // 1/8 celda/frame -> alinea cada 8 frames
const GHOST_SPEED = 0.1;         // 1/10 celda/frame (ambusher, flanker, shy)
const GHOST_SPEED_CHASER = 0.125; // 1/8 celda/frame: el chaser, igual que Pac-Man
const ENERGY_SCORE = 50;         // pts por bola de poder

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid ) for ( const v of row ) if ( v === 2 || v === 4 ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    grid,
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( ( g ) => ( {
      x: g.x,
      y: g.y,
      dir: 'up',
      kind: g.kind,
      speed: g.kind === 'chaser' ? GHOST_SPEED_CHASER : GHOST_SPEED,
      released: g.releaseDelay === 0,
      waitFrames: Math.round( g.releaseDelay * 60 ), // 60 frames = 1 s
    } ) ),
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Una celda es muro para el actor dado?
//   pacman: bloqueado por pared (1) y puerta (3)
//   ghost:  bloqueado solo por pared (1)
//   ghost con doorBlocks (no liberado): la puerta (3) tambien bloquea, para
//   que rebote dentro de la pen mientras espera su turno de salida.
function isWall( grid, x, y, actor, doorBlocks ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 && ( actor === 'pacman' || doorBlocks ) ) return true;
  return false;
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir, actor, doorBlocks ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty, actor, doorBlocks );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot.
    if ( grid[ p.y ][ p.x ] === 2 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 10;
      game.dotsRemaining--;
    }
    // Comer bola de poder.
    if ( grid[ p.y ][ p.x ] === 4 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += ENERGY_SCORE;
      game.dotsRemaining--;
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

// Pen (casa de los fantasmas): celdas interiores donde esperan su salida.
// La puerta (tile 3) esta en la fila 12, cols 13-14.
const PEN = { x0: 11, x1: 16, y0: 13, y1: 15 };
const DOOR_ROW = 12;
const DOOR_COLS = [ 13, 14 ];

function insidePen( x, y ) {
  return x >= PEN.x0 && x <= PEN.x1 && y >= PEN.y0 && y <= PEN.y1;
}

// La puerta bloquea a quien no esta liberado o ya esta fuera de la pen: un
// no-liberado patrulla dentro sin salir; un liberado de fuera no reentra.
// Solo el liberado que sigue dentro la cruza, hacia fuera.
function blocksDoor( g ) {
  return !g.released || !insidePen( g.x, g.y );
}

// Devuelve la direccion de `choices` que minimiza la distancia Manhattan
// desde la celda actual del fantasma hasta el punto objetivo (tx, ty).
function pickToward( choices, g, tx, ty ) {
  let best = choices[ 0 ];
  let bestDist = Infinity;
  for ( const dir of choices ) {
    const d = DIRS[ dir ];
    const nx = g.x + d.x;
    const ny = g.y + d.y;
    const dist = Math.abs( nx - tx ) + Math.abs( ny - ty );
    if ( dist < bestDist ) {
      bestDist = dist;
      best = dir;
    }
  }
  return best;
}

function decideGhost( game, g ) {
  const grid = game.grid;
  const p = game.pacman;
  const px = Math.round( p.x );
  const py = Math.round( p.y );

  const options = Object.keys( DIRS ).filter(
    ( dir ) =>
      dir !== OPPOSITE[ g.dir ] &&
      canMove( grid, g.x, g.y, dir, 'ghost', blocksDoor( g ) )
  );
  // Sin salida (callejon): permitir el giro de 180.
  const choices = options.length ? options : [ OPPOSITE[ g.dir ] ];

  // target != null -> persigue ese punto; target == null -> vaga al azar.
  let target = null;

  // La estrategia del kind solo aplica una vez liberado y fuera de la pen.
  // Mientras no esta liberado, target queda null: deambula al azar entre los
  // vecinos validos del interior de la pen (la puerta le bloquea, doorBlocks).
  if ( g.released ) {
    if ( insidePen( g.x, g.y ) ) {
      // Salida de la pen: mientras esta liberado pero aun dentro, apunta a la
      // puerta mas cercana (fila 12) en vez de a su objetivo de estrategia.
      target = { x: g.x <= DOOR_COLS[ 0 ] ? DOOR_COLS[ 0 ] : DOOR_COLS[ 1 ], y: DOOR_ROW };
    } else if ( g.kind === 'chaser' ) {
      // Agresivo: siempre hacia la celda de Pac-Man.
      target = { x: px, y: py };
    } else if ( g.kind === 'ambusher' ) {
      // Apunta 2 celdas por delante de Pac-Man segun su direccion; si esa
      // celda no es transitable, cae a la celda de Pac-Man.
      const d = DIRS[ p.dir ];
      const tx = px + d.x * 2;
      const ty = py + d.y * 2;
      target = { x: tx, y: ty };
      if ( isWall( grid, tx, ty, 'ghost', blocksDoor( g ) ) ) target = { x: px, y: py };
    } else if ( g.kind === 'flanker' ) {
      // Refleja el punto 2 celdas por delante de Pac-Man respecto a la celda
      // actual del chaser: target = 2 * porDelante - chaser.
      const d = DIRS[ p.dir ];
      const ax = px + d.x * 2;
      const ay = py + d.y * 2;
      const chaser = game.ghosts.find( ( o ) => o.kind === 'chaser' );
      if ( chaser ) {
        target = {
          x: 2 * ax - Math.round( chaser.x ),
          y: 2 * ay - Math.round( chaser.y ),
        };
      } else {
        target = { x: px, y: py };
      }
    } else if ( g.kind === 'shy' ) {
      // Persigue solo si Pac-Man esta lejos (> 8 celdas); si no, vaga.
      const dist = Math.abs( g.x - px ) + Math.abs( g.y - py );
      if ( dist > 8 ) target = { x: px, y: py };
    }
  }

  if ( target ) g.dir = pickToward( choices, g, target.x, target.y );
  else g.dir = choices[ Math.floor( Math.random() * choices.length ) ];
}

function moveGhost( game, g ) {
  const grid = game.grid;
  const width = grid[ 0 ].length;

  // Cuenta atras de la salida escalonada: 1 frame = 1/60 s.
  if ( !g.released ) {
    g.waitFrames--;
    if ( g.waitFrames <= 0 ) g.released = true;
  }

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    decideGhost( game, g );
    if ( !canMove( grid, g.x, g.y, g.dir, 'ghost', blocksDoor( g ) ) ) return;
  }

  const d = DIRS[ g.dir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
  wrapTunnel( g, width );
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  game.ghosts.forEach( ( g, i ) => {
    g.x = GHOST_STARTS[ i ].x;
    g.y = GHOST_STARTS[ i ].y;
    g.dir = 'up';
    g.released = GHOST_STARTS[ i ].releaseDelay === 0;
    g.waitFrames = Math.round( GHOST_STARTS[ i ].releaseDelay * 60 );
  } );
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

function update( game ) {
  movePacman( game );
  game.ghosts.forEach( ( g ) => moveGhost( game, g ) );

  for ( const g of game.ghosts ) {
    if ( collides( game.pacman, g ) ) {
      game.lives--;
      if ( game.lives <= 0 ) {
        game.state = 'lost';
        return;
      }
      resetPositions( game );
      break;
    }
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
