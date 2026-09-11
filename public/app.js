const EMPTY = 0, BLACK = 1, WHITE = 2;
const SAVE_KEY = 'go-p2p-save-v5';

const STARS = {
  9: [
    [2, 2], [2, 6], [4, 4],
    [6, 2], [6, 6]
  ],
  13: [
    [3, 3], [3, 9], [6, 6],
    [9, 3], [9, 9],
    [6, 3], [6, 9],
    [3, 6], [9, 6]
  ],
  19: [
    [3, 3], [3, 9], [3, 15],
    [9, 3], [9, 9], [9, 15],
    [15, 3], [15, 9], [15, 15]
  ]
};


/* =========================================================
   Go Game
========================================================= */

class GoGame {
  
  
  constructor(size = 19) {

    this.size = size;

    this.board =
      Array.from(
        { length: size },
        () => Array(size).fill(EMPTY)
      );

    this.currentPlayer = BLACK;

    this.captures = {
      [BLACK]: 0,
      [WHITE]: 0
    };

    this.history = [];

    this.koPoint = null;
    this.lastMove = null;
    this.passCount = 0;
    this.gameOver = false;
  }


  inBounds(x, y) {
    return (
      x >= 0 &&
      x < this.size &&
      y >= 0 &&
      y < this.size
    );
  }


  neighbors(x, y) {

    const r = [];

    if (this.inBounds(x - 1, y))
      r.push([x - 1, y]);

    if (this.inBounds(x + 1, y))
      r.push([x + 1, y]);

    if (this.inBounds(x, y - 1))
      r.push([x, y - 1]);

    if (this.inBounds(x, y + 1))
      r.push([x, y + 1]);

    return r;
  }


  group(x, y) {

    const c = this.board[x][y];

    if (c === EMPTY) {
      return {
        stones: [],
        lib: new Set()
      };
    }

    const visited = new Set();
    const stones = [];
    const lib = new Set();

    const stack = [[x, y]];

    while (stack.length) {

      const [cx, cy] = stack.pop();

      const key = `${cx},${cy}`;

      if (visited.has(key))
        continue;

      visited.add(key);
      stones.push([cx, cy]);

      for (const [nx, ny] of this.neighbors(cx, cy)) {

        const nkey = `${nx},${ny}`;
        const value = this.board[nx][ny];

        if (value === EMPTY) {

          lib.add(nkey);

        } else if (
          value === c &&
          !visited.has(nkey)
        ) {

          stack.push([nx, ny]);
        }
      }
    }

    return {
      stones,
      lib
    };
  }


  remove(stones) {

    for (const [x, y] of stones) {
      this.board[x][y] = EMPTY;
    }

    return stones.length;
  }


  hash() {
    return this.board
      .map(row => row.join(''))
      .join('|');
  }


  place(x, y) {

    if (this.gameOver) {
      return {
        ok: false,
        code: 'over', msg: '遊戲已結束'
      };
    }

    if (!this.inBounds(x, y)) {
      return {
        ok: false,
        code: 'bounds', msg: '超出邊界'
      };
    }

    if (this.board[x][y] !== EMPTY) {
      return {
        ok: false,
        code: 'occupied', msg: '此位置已有棋子'
      };
    }

    if (
      this.koPoint &&
      this.koPoint.x === x &&
      this.koPoint.y === y
    ) {
      return {
        ok: false,
        code: 'ko', msg: '打劫禁止'
      };
    }


    const player = this.currentPlayer;

    const opponent =
      player === BLACK
        ? WHITE
        : BLACK;

    const previousHash = this.hash();


    this.board[x][y] = player;


    const captured = [];


    for (const [nx, ny] of this.neighbors(x, y)) {

      if (this.board[nx][ny] !== opponent)
        continue;

      const group = this.group(nx, ny);

      if (group.lib.size === 0) {

        captured.push(...group.stones);

        this.remove(group.stones);
      }
    }


    const ownGroup = this.group(x, y);


    if (ownGroup.lib.size === 0) {

      this.board[x][y] = EMPTY;

      for (const [cx, cy] of captured) {
        this.board[cx][cy] = opponent;
      }

      return {
        ok: false,
        code: 'suicide', msg: '禁止自殺'
      };
    }


    /*
     * Ko / superko 簡單檢查
     */
    if (captured.length === 1) {

      const newHash = this.hash();

      for (
        let i = this.history.length - 1;
        i >= Math.max(0, this.history.length - 3);
        i--
      ) {

        if (this.history[i].hash === newHash) {

          this.board[x][y] = EMPTY;

          for (const [cx, cy] of captured) {
            this.board[cx][cy] = opponent;
          }

          return {
            ok: false,
            code: 'superko', msg: '打劫禁止重複局面'
          };
        }
      }
    }


    this.captures[player] += captured.length;

    this.koPoint =
      captured.length === 1
        ? {
            x: captured[0][0],
            y: captured[0][1]
          }
        : null;

    this.lastMove = {
      x,
      y
    };

    this.passCount = 0;


    this.history.push({
      hash: previousHash,

      move: {
        x,
        y,
        p: player
      },

      captured: captured.map(v => [...v]),

      koPoint:
        this.koPoint
          ? { ...this.koPoint }
          : null
    });


    this.currentPlayer = opponent;


    return {
      ok: true,

      x,
      y,

      player,

      captured,

      captures: {
        ...this.captures
      },

      koPoint:
        this.koPoint
          ? { ...this.koPoint }
          : null,

      lastMove:
        this.lastMove
          ? { ...this.lastMove }
          : null,

      passCount: this.passCount
    };
  }


  pass() {

    if (this.gameOver) {
      return {
        ok: false,
        code: 'over', msg: '遊戲已結束'
      };
    }


    const passingPlayer =
      this.currentPlayer;


    this.passCount++;


    this.history.push({

      hash: this.hash(),

      move: {
        pass: true,
        p: passingPlayer
      },

      captured: [],

      koPoint: null
    });


    this.koPoint = null;
    this.lastMove = null;


    this.currentPlayer =
      this.currentPlayer === BLACK
        ? WHITE
        : BLACK;


    if (this.passCount >= 2) {
      this.gameOver = true;
    }


    return {

      ok: true,

      pass: true,

      passingPlayer,

      nextPlayer:
        this.currentPlayer,

      gameOver:
        this.gameOver,

      captures: {
        ...this.captures
      },

      passCount:
        this.passCount
    };
  }


  undo() {

    if (this.history.length === 0) {

      return {
        ok: false,
        code: 'noUndo', msg: '無棋可悔'
      };
    }


    const last =
      this.history.pop();


    if (!last.move.pass) {

      const {
        x,
        y,
        p
      } = last.move;


      const opponent =
        p === BLACK
          ? WHITE
          : BLACK;


      for (const [cx, cy] of last.captured) {
        this.board[cx][cy] = opponent;
      }


      if (last.captured.length > 0) {

        this.captures[p] -=
          last.captured.length;

        if (this.captures[p] < 0)
          this.captures[p] = 0;
      }


      this.board[x][y] = EMPTY;


      this.currentPlayer = p;


      let previousMove = null;


      for (
        let i = this.history.length - 1;
        i >= 0;
        i--
      ) {

        const h =
          this.history[i];

        if (
          h.move &&
          !h.move.pass
        ) {

          previousMove = {
            x: h.move.x,
            y: h.move.y
          };

          break;
        }
      }


      this.lastMove =
        previousMove;


      this.passCount = 0;

    } else {

      this.currentPlayer =
        last.move.p;

      if (this.passCount > 0)
        this.passCount--;

      this.lastMove = null;
    }


    this.gameOver = false;


    this.koPoint =
      last.koPoint
        ? { ...last.koPoint }
        : null;


    return {

      ok: true,

      captures: {
        ...this.captures
      },

      currentPlayer:
        this.currentPlayer,

      lastMove:
        this.lastMove,

      koPoint:
        this.koPoint
    };
  }


  reset() {

    this.board =
      Array.from(
        { length: this.size },
        () => Array(this.size).fill(EMPTY)
      );

    this.currentPlayer = BLACK;

    this.captures = {
      [BLACK]: 0,
      [WHITE]: 0
    };

    this.history = [];

    this.koPoint = null;
    this.lastMove = null;
    this.passCount = 0;
    this.gameOver = false;
  }


  calculateChineseScore(
    komi = 7.5
  ) {

    const size = this.size;


    const visited =
      Array.from(
        { length: size },
        () => Array(size).fill(false)
      );


    let blackStones = 0;
    let whiteStones = 0;

    let blackTerritory = 0;
    let whiteTerritory = 0;

    let dame = 0;


    for (let x = 0; x < size; x++) {

      for (let y = 0; y < size; y++) {

        if (this.board[x][y] === BLACK)
          blackStones++;

        else if (this.board[x][y] === WHITE)
          whiteStones++;
      }
    }


    for (let x = 0; x < size; x++) {

      for (let y = 0; y < size; y++) {

        if (
          this.board[x][y] !== EMPTY ||
          visited[x][y]
        ) {
          continue;
        }


        const region = [];

        const queue = [[x, y]];

        visited[x][y] = true;

        let touchesBlack = false;
        let touchesWhite = false;

        let head = 0;


        while (head < queue.length) {

          const [
            cx,
            cy
          ] = queue[head++];

          region.push([cx, cy]);


          for (const [
            nx,
            ny
          ] of this.neighbors(cx, cy)) {

            const c =
              this.board[nx][ny];


            if (c === BLACK) {

              touchesBlack = true;

            } else if (c === WHITE) {

              touchesWhite = true;

            } else if (
              c === EMPTY &&
              !visited[nx][ny]
            ) {

              visited[nx][ny] = true;

              queue.push([
                nx,
                ny
              ]);
            }
          }
        }


        if (
          touchesBlack &&
          !touchesWhite
        ) {

          blackTerritory +=
            region.length;

        } else if (
          touchesWhite &&
          !touchesBlack
        ) {

          whiteTerritory +=
            region.length;

        } else {

          dame +=
            region.length;
        }
      }
    }


    const blackTotal =
      blackStones +
      blackTerritory;


    const whiteTotal =
      whiteStones +
      whiteTerritory +
      komi;


    const winner =
      blackTotal > whiteTotal
        ? BLACK
        : WHITE;


    const diff =
      Math.abs(
        blackTotal -
        whiteTotal
      );


    return {

      blackStones,
      whiteStones,

      blackTerritory,
      whiteTerritory,

      blackTotal,
      whiteTotal,

      komi,

      winner,
      diff,

      dame
    };
  }


  getFullState() {

    return {

      size: this.size,

      board:
        this.board.map(
          row => [...row]
        ),

      currentPlayer:
        this.currentPlayer,

      captures:
        { ...this.captures },

      history:
        this.history.map(h => ({
          ...h,

          move:
            h.move
              ? { ...h.move }
              : h.move,

          captured:
            (h.captured || [])
              .map(v => [...v]),

          koPoint:
            h.koPoint
              ? { ...h.koPoint }
              : null
        })),

      koPoint:
        this.koPoint
          ? { ...this.koPoint }
          : null,

      lastMove:
        this.lastMove
          ? { ...this.lastMove }
          : null,

      passCount:
        this.passCount,

      gameOver:
        this.gameOver
    };
  }


  loadFullState(s) {

    if (!s || !s.size || !s.board)
      return;


    this.size = s.size;


    this.board =
      s.board.map(
        row => [...row]
      );


    this.currentPlayer =
      s.currentPlayer;


    this.captures =
      { ...s.captures };


    this.history =
      (s.history || []).map(h => ({

        ...h,

        move:
          h.move
            ? { ...h.move }
            : h.move,

        captured:
          (h.captured || [])
            .map(v => [...v]),

        koPoint:
          h.koPoint
            ? { ...h.koPoint }
            : null
      }));


    this.koPoint =
      s.koPoint
        ? { ...s.koPoint }
        : null;


    this.lastMove =
      s.lastMove
        ? { ...s.lastMove }
        : null;


    this.passCount =
      s.passCount || 0;


    this.gameOver =
      !!s.gameOver;
  }
}


/* =========================================================
   DOM
========================================================= */

const lobby =
  document.getElementById('lobby');

const gameScreen =
  document.getElementById('gameScreen');

const boardCanvas =
  document.getElementById('boardCanvas');

const ctx =
  boardCanvas
    ? boardCanvas.getContext('2d')
    : null;


/* =========================================================
   Global State
========================================================= */

let game = null;

let mode = null;

let myColor = BLACK;

let cellSize = 30;

let margin = 30;

let hoverPos = null;

let pendingUndo = false;

let peerConnections = new Set();

let peerConn = null;

let p2pRoomCode = null;

let isHost = false;

let peerInst = null;

let peerLoaded =
  typeof Peer !== 'undefined';


/* P2P connection state */

let heartbeatTimer = null;

let reconnectTimer = null;

let reconnectAttempts = 0;

let manuallyLeaving = false;

let opponentLeft = false;


/* =========================================================
   Helpers
========================================================= */

function $(id) {
  return document.getElementById(id);
}


/* =========================================================
   Board Size UI
========================================================= */

function updateBoardSizeUI() {

  document
    .querySelectorAll(
      '.size-row label'
    )
    .forEach(label => {

      const radio =
        label.querySelector(
          'input[name="boardSize"]'
        );

      if (!radio)
        return;

      label.classList.toggle(
        'checked',
        radio.checked
      );
    });
}


/*
 * 修复：
 * 点击 9 / 13 / 19 后，
 * label 颜色没有跟着改变。
 */
document
  .querySelectorAll(
    'input[name="boardSize"]'
  )
  .forEach(radio => {

    radio.addEventListener(
      'change',
      updateBoardSizeUI
    );

    radio.addEventListener(
      'click',
      updateBoardSizeUI
    );
  });


updateBoardSizeUI();


/* =========================================================
   Save / Load
========================================================= */

function saveGameToStorage() {

  if (!game || !mode)
    return;


  try {

    const payload = {

      mode,

      myColor,

      isHost,

      roomCode:
        p2pRoomCode || null,

      state:
        game.getFullState(),

      savedAt:
        Date.now()
    };


    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify(payload)
    );

  } catch (e) {

    console.warn(
      'saveGameToStorage failed:',
      e
    );
  }
}


function clearSavedGame() {

  try {

    localStorage.removeItem(
      SAVE_KEY
    );

  } catch (e) {}
}


/* =========================================================
   Log
========================================================= */

function addLog(
  text,
  cls = ''
) {

  const log =
    $('messageLog');

  if (!log)
    return;


  const el =
    document.createElement('div');


  el.className =
    'log-entry ' +
    (cls || '');


  const t =
    new Date()
      .toLocaleTimeString(
        window.I18N
          ? I18N.locale()
          : 'zh-TW',
        {
          hour12: false
        }
      );


  el.textContent =
    `[${t}] ${text}`;


  log.appendChild(el);

  log.scrollTop =
    log.scrollHeight;
}


/* =========================================================
   Connection UI
========================================================= */

function setConnStatus(
  text,
  cls = 'ok'
) {

  const s =
    $('connStatus');

  if (!s)
    return;


  s.textContent =
    text;


  s.className =
    'badge ' +
    cls;
}


function setP2PStatus(
  which,
  text,
  cls = ''
) {

  const el =
    $(
      which === 'host'
        ? 'p2pHostStatus'
        : 'p2pJoinStatus'
    );


  if (!el)
    return;


  el.textContent =
    text;


  el.className =
    'status ' +
    (cls || '');
}


/* =========================================================
   Can Play
========================================================= */

function canPlay() {

  if (!game)
    return false;


  if (game.gameOver)
    return false;


  if (mode === 'hotseat')
    return true;


  return (
    game.currentPlayer ===
    myColor
  );
}


/* =========================================================
   Canvas
========================================================= */

function setupCanvas() {

  if (
    !game ||
    !boardCanvas ||
    !ctx
  ) {
    return;
  }


  const dpr =
    window.devicePixelRatio || 1;


  const rect =
    boardCanvas.getBoundingClientRect();


  if (rect.width === 0)
    return;


  boardCanvas.width =
    rect.width * dpr;


  boardCanvas.height =
    rect.height * dpr;


  ctx.setTransform(
    dpr,
    0,
    0,
    dpr,
    0,
    0
  );


  margin =
    rect.width * 0.055;


  cellSize =
    (rect.width - margin * 2) /
    (game.size - 1);
}


/* =========================================================
   Draw Board
========================================================= */

function drawBoard() {

  if (
    !game ||
    !boardCanvas ||
    !ctx
  ) {
    return;
  }


  const displayW =
    boardCanvas
      .getBoundingClientRect()
      .width;


  if (displayW === 0) {

    setTimeout(
      drawBoard,
      50
    );

    return;
  }


  const size =
    game.size;


  ctx.clearRect(
    0,
    0,
    displayW,
    displayW
  );


  const gradient =
    ctx.createLinearGradient(
      0,
      0,
      displayW,
      displayW
    );


  gradient.addColorStop(
    0,
    '#e6c38a'
  );

  gradient.addColorStop(
    1,
    '#d4a85f'
  );


  ctx.fillStyle =
    gradient;


  roundRect(
    ctx,
    0,
    0,
    displayW,
    displayW,
    12
  );


  ctx.fill();


  ctx.strokeStyle =
    '#3a2a15';

  ctx.lineWidth = 1;


  for (
    let i = 0;
    i < size;
    i++
  ) {

    const p =
      margin +
      i * cellSize;


    ctx.beginPath();

    ctx.moveTo(
      margin,
      p
    );

    ctx.lineTo(
      margin +
      (size - 1) *
      cellSize,
      p
    );


    ctx.moveTo(
      p,
      margin
    );

    ctx.lineTo(
      p,
      margin +
      (size - 1) *
      cellSize
    );


    ctx.stroke();
  }


  const stars =
    STARS[size] || [];


  ctx.fillStyle =
    '#3a2a15';


  for (
    const [sx, sy]
    of stars
  ) {

    const cx =
      margin +
      sx * cellSize;

    const cy =
      margin +
      sy * cellSize;


    ctx.beginPath();

    ctx.arc(
      cx,
      cy,
      cellSize * 0.1,
      0,
      Math.PI * 2
    );

    ctx.fill();
  }


  const labels =
    'ABCDEFGHJKLMNOPQRST';


  ctx.fillStyle =
    '#5a4025';


  ctx.font =
    `${Math.max(
      10,
      cellSize * 0.35
    )}px sans-serif`;


  ctx.textAlign =
    'center';

  ctx.textBaseline =
    'middle';


  for (
    let i = 0;
    i < size;
    i++
  ) {

    const p =
      margin +
      i * cellSize;


    ctx.fillText(
      labels[i],
      p,
      margin * 0.42
    );


    ctx.fillText(
      labels[i],
      p,
      displayW -
      margin * 0.42
    );


    ctx.fillText(
      String(size - i),
      margin * 0.42,
      p
    );


    ctx.fillText(
      String(size - i),
      displayW -
      margin * 0.42,
      p
    );
  }


  for (
    let x = 0;
    x < size;
    x++
  ) {

    for (
      let y = 0;
      y < size;
      y++
    ) {

      if (
        game.board[x][y] !== EMPTY
      ) {

        drawStone(
          x,
          y,
          game.board[x][y]
        );
      }
    }
  }


  /* Last move */

  if (game.lastMove) {

    const {
      x,
      y
    } = game.lastMove;


    const cx =
      margin +
      x * cellSize;


    const cy =
      margin +
      y * cellSize;


    ctx.strokeStyle =
      game.board[x][y] === BLACK
        ? '#ff4757'
        : '#e74c3c';


    ctx.lineWidth = 2;


    ctx.beginPath();

    ctx.arc(
      cx,
      cy,
      cellSize * 0.22,
      0,
      Math.PI * 2
    );

    ctx.stroke();
  }


  /* Ko */

  if (game.koPoint) {

    const {
      x,
      y
    } = game.koPoint;


    const cx =
      margin +
      x * cellSize;


    const cy =
      margin +
      y * cellSize;


    ctx.fillStyle =
      'rgba(231,76,60,0.35)';


    ctx.beginPath();

    ctx.arc(
      cx,
      cy,
      cellSize * 0.3,
      0,
      Math.PI * 2
    );

    ctx.fill();
  }


  /* Hover */

  if (
    hoverPos &&
    canPlay()
  ) {

    const {
      x,
      y
    } = hoverPos;


    if (
      game.board[x][y] === EMPTY &&
      !(
        game.koPoint &&
        game.koPoint.x === x &&
        game.koPoint.y === y
      )
    ) {

      const cx =
        margin +
        x * cellSize;


      const cy =
        margin +
        y * cellSize;


      const c =
        mode === 'hotseat'
          ? game.currentPlayer
          : myColor;


      ctx.fillStyle =
        c === BLACK
          ? 'rgba(0,0,0,0.35)'
          : 'rgba(255,255,255,0.5)';


      ctx.beginPath();

      ctx.arc(
        cx,
        cy,
        cellSize * 0.42,
        0,
        Math.PI * 2
      );

      ctx.fill();
    }
  }
}


/* =========================================================
   Draw Stone
========================================================= */

function drawStone(
  x,
  y,
  c
) {

  const cx =
    margin +
    x * cellSize;


  const cy =
    margin +
    y * cellSize;


  const r =
    cellSize * 0.46;


  ctx.save();


  ctx.shadowColor =
    'rgba(0,0,0,0.35)';


  ctx.shadowBlur =
    cellSize * 0.15;


  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 2;


  const gradient =
    ctx.createRadialGradient(
      cx - r * 0.35,
      cy - r * 0.35,
      r * 0.1,
      cx,
      cy,
      r
    );


  if (c === BLACK) {

    gradient.addColorStop(
      0,
      '#666'
    );

    gradient.addColorStop(
      0.5,
      '#222'
    );

    gradient.addColorStop(
      1,
      '#000'
    );

  } else {

    gradient.addColorStop(
      0,
      '#fff'
    );

    gradient.addColorStop(
      0.7,
      '#e8e8e8'
    );

    gradient.addColorStop(
      1,
      '#bdbdbd'
    );
  }


  ctx.fillStyle =
    gradient;


  ctx.beginPath();

  ctx.arc(
    cx,
    cy,
    r,
    0,
    Math.PI * 2
  );

  ctx.fill();


  ctx.restore();
}


/* =========================================================
   Round Rect
========================================================= */

function roundRect(
  ctx,
  x,
  y,
  w,
  h,
  r
) {

  ctx.beginPath();

  ctx.moveTo(
    x + r,
    y
  );

  ctx.lineTo(
    x + w - r,
    y
  );

  ctx.quadraticCurveTo(
    x + w,
    y,
    x + w,
    y + r
  );

  ctx.lineTo(
    x + w,
    y + h - r
  );

  ctx.quadraticCurveTo(
    x + w,
    y + h,
    x + w - r,
    y + h
  );

  ctx.lineTo(
    x + r,
    y + h
  );

  ctx.quadraticCurveTo(
    x,
    y + h,
    x,
    y + h - r
  );

  ctx.lineTo(
    x,
    y + r
  );

  ctx.quadraticCurveTo(
    x,
    y,
    x + r,
    y
  );

  ctx.closePath();
}


/* =========================================================
   Pixel -> Position
========================================================= */

function pixToPos(
  px,
  py
) {

  if (!game)
    return null;


  const rect =
    boardCanvas
      .getBoundingClientRect();


  const x =
    (
      px -
      rect.left -
      margin
    ) /
    cellSize;


  const y =
    (
      py -
      rect.top -
      margin
    ) /
    cellSize;


  const rx =
    Math.round(x);


  const ry =
    Math.round(y);


  if (
    rx < 0 ||
    rx >= game.size ||
    ry < 0 ||
    ry >= game.size
  ) {

    return null;
  }


  const cx =
    margin +
    rx * cellSize;


  const cy =
    margin +
    ry * cellSize;


  const distance =
    Math.sqrt(
      (
        px -
        rect.left -
        cx
      ) ** 2 +
      (
        py -
        rect.top -
        cy
      ) ** 2
    );


  if (
    distance >
    cellSize * 0.5
  ) {

    return null;
  }


  return {
    x: rx,
    y: ry
  };
}


/* =========================================================
   Canvas Events
========================================================= */

if (boardCanvas) {

  boardCanvas.addEventListener(
    'click',
    e => {

      const pos =
        pixToPos(
          e.clientX,
          e.clientY
        );


      if (
        canPlay() &&
        pos
      ) {

        doMove(
          pos.x,
          pos.y
        );
      }
    }
  );


  boardCanvas.addEventListener(
    'mousemove',
    e => {

      const pos =
        pixToPos(
          e.clientX,
          e.clientY
        );


      if (
        JSON.stringify(pos) !==
        JSON.stringify(hoverPos)
      ) {

        hoverPos = pos;

        drawBoard();
      }
    }
  );


  boardCanvas.addEventListener(
    'mouseleave',
    () => {

      if (hoverPos) {

        hoverPos = null;

        drawBoard();
      }
    }
  );
}


window.addEventListener(
  'resize',
  () => {

    if (game) {

      setupCanvas();
      drawBoard();
    }
  }
);


/* =========================================================
   Modal
========================================================= */

let modalCallback = null;


function showModal(
  title,
  body,
  callback
) {

  $('modalTitle').textContent =
    title;

  $('modalBody').innerHTML =
    body;

  modalCallback =
    callback;


  $('modalOverlay')
    ?.classList.remove(
      'hidden'
    );
}


function closeModal() {

  $('modalOverlay')
    ?.classList.add(
      'hidden'
    );

  modalCallback = null;
}


$('modalCancel')
  ?.addEventListener(
    'click',
    () => {

      const cb =
        modalCallback;

      closeModal();

      if (cb)
        cb(false);
    }
  );


$('modalOk')
  ?.addEventListener(
    'click',
    () => {

      const cb =
        modalCallback;

      closeModal();

      if (cb)
        cb(true);
    }
  );


/* =========================================================
   Buttons
========================================================= */

$('passBtn')
  ?.addEventListener(
    'click',
    () => {

      if (canPlay())
        doPass();
    }
  );


$('undoBtn')
  ?.addEventListener(
    'click',
    requestUndo
  );


$('newGameBtn')
  ?.addEventListener(
    'click',
    () => {

      showModal(
        t('dyn.confirmNewTitle'),
        t('dyn.confirmNewBody'),
        ok => {

          if (ok)
            doNewGame(false);
        }
      );
    }
  );


$('leaveBtn')
  ?.addEventListener(
    'click',
    leaveGame
  );


/* =========================================================
   Lobby Navigation
========================================================= */

function showLobbyHome() {

  $('lobbyHome')
    ?.classList.remove(
      'hidden'
    );

  $('p2pHostScreen')
    ?.classList.add(
      'hidden'
    );

  $('p2pJoinScreen')
    ?.classList.add(
      'hidden'
    );

  updateBoardSizeUI();
}


function showHostScreen() {

  $('lobbyHome')
    ?.classList.add(
      'hidden'
    );

  $('p2pHostScreen')
    ?.classList.remove(
      'hidden'
    );

  $('p2pJoinScreen')
    ?.classList.add(
      'hidden'
    );
}


function showJoinScreen() {

  $('lobbyHome')
    ?.classList.add(
      'hidden'
    );

  $('p2pHostScreen')
    ?.classList.add(
      'hidden'
    );

  $('p2pJoinScreen')
    ?.classList.remove(
      'hidden'
    );
}


/* =========================================================
   Mode Buttons
========================================================= */

document
  .querySelectorAll(
    '[data-action]'
  )
  .forEach(el => {

    el.addEventListener(
      'click',
      () => {

        handleAction(
          el.dataset.action
        );
      }
    );
  });


$('backFromHost')
  ?.addEventListener(
    'click',
    () => {

      if (peerInst) {

        try {
          peerInst.destroy();
        } catch (e) {}

        peerInst = null;
      }

      showLobbyHome();
    }
  );

$('copyRoomBtn')?.addEventListener(
  'click',
  async () => {
    // 1. 取得邀請碼輸入框與數值
    const inputEl = $('p2pRoomCode');
    const roomCode = inputEl?.value;

    if (!roomCode) {
      console.warn('邀請碼尚未生成或為空');
      return;
    }

    try {
      // 2. 優先使用現代 Clipboard API (僅限 HTTPS / localhost)
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(roomCode);
      } else {
        // 3. HTTP 或舊版瀏覽器的相容方案
        inputEl.select();
        inputEl.setSelectionRange(0, 99999); // 針對行動裝置 (iOS) 強化
        document.execCommand('copy');
        window.getSelection()?.removeAllRanges(); // 取消選取狀態
      }

      // 4. 成功回饋
      const btn = $('copyRoomBtn');
      if (btn) {
        const originalText = btn.innerText;
        btn.innerText = t('dyn.copied');

        setTimeout(() => {
          btn.innerText = originalText;
        }, 2000);
      }

    } catch (e) {
      console.error('複製失敗:', e);
    }
  }
);

$('backFromJoin')
  ?.addEventListener(
    'click',
    () => {

      showLobbyHome();
    }
  );


$('submitRoomBtn')
  ?.addEventListener(
    'click',
    () => {

      const v =
        (
          $('p2pRoomInput')
            ?.value || ''
        )
          .trim()
          .toUpperCase();


      if (v.length >= 4) {

        peerJoinRoom(v);

      } else {

        setP2PStatus(
          'join',
          t('dyn.invalidCode'),
          'error'
        );
      }
    }
  );


function handleAction(act) {

  let size = 19;


  document
    .querySelectorAll(
      'input[name="boardSize"]'
    )
    .forEach(r => {

      if (r.checked)
        size =
          parseInt(
            r.value,
            10
          );
    });


  if (act === 'hotseat') {

    startGame(
      'hotseat',
      size,
      BLACK
    );

  } else if (
    act === 'p2p-host'
  ) {

    showHostScreen();

    peerHostRoom(size);

  } else if (
    act === 'goto-join'
  ) {

    showJoinScreen();

    $('p2pRoomInput').value = '';
  }
}


/* =========================================================
   Start Game
========================================================= */

function startGame(
  m,
  size,
  color
) {

  mode = m;

  myColor = color;


  if (
    !game ||
    game.size !== size
  ) {

    game =
      new GoGame(size);
  }


  lobby
    ?.classList.add(
      'hidden'
    );


  gameScreen
    ?.classList.remove(
      'hidden'
    );


  $('connMode').textContent =
    m === 'hotseat'
      ? t('game.modeLocal')
      : t('game.modeP2p');


  $('myRole').textContent =
    m === 'hotseat'
      ? t('dyn.roleShared')
      : (
          color === BLACK
            ? t('dyn.roleBlack')
            : t('dyn.roleWhite')
        );


  $('messageLog').innerHTML =
    '';


  pendingUndo = false;


  addLog(
    t('dyn.start'),
    'system'
  );


  updateUI();

  saveGameToStorage();


  setTimeout(
    () => {

      setupCanvas();

      drawBoard();

    },
    100
  );
}


/* =========================================================
   Remote Move
========================================================= */

function applyMoveRemote(r) {

  if (
    !r ||
    !r.ok ||
    !game
  ) {
    return;
  }


  const prevHash =
    game.hash();


  if (
    r.captured &&
    r.captured.length
  ) {

    for (
      const [cx, cy]
      of r.captured
    ) {

      game.board[cx][cy] =
        EMPTY;
    }
  }


  game.board[r.x][r.y] =
    r.player;


  game.currentPlayer =
    r.player === BLACK
      ? WHITE
      : BLACK;


  game.captures =
    { ...r.captures };


  game.lastMove =
    r.lastMove
      ? { ...r.lastMove }
      : null;


  game.koPoint =
    r.koPoint
      ? { ...r.koPoint }
      : null;


  game.passCount =
    r.passCount || 0;


  game.history.push({

    hash: prevHash,

    move: {
      x: r.x,
      y: r.y,
      p: r.player
    },

    captured:
      (r.captured || [])
        .map(v => [...v]),

    koPoint:
      r.koPoint
        ? { ...r.koPoint }
        : null
  });


  updateUI();

  drawBoard();

  saveGameToStorage();


  window.GoSound?.play(
    r.captured && r.captured.length
      ? 'capture'
      : 'stone'
  );
}


/* =========================================================
   Remote Pass
========================================================= */

function applyPassRemote(r) {

  if (!game || !r)
    return;


  game.captures =
    { ...r.captures };


  game.history.push({

    hash:
      game.hash(),

    move: {
      pass: true,
      p: r.passingPlayer
    },

    captured: [],

    koPoint: null
  });


  game.currentPlayer =
    r.nextPlayer;


  game.lastMove = null;

  game.koPoint = null;

  game.passCount =
    r.passCount || 1;


  if (r.gameOver) {

    game.gameOver =
      true;
  }


  updateUI();

  drawBoard();

  saveGameToStorage();
}


/* =========================================================
   Local Move
========================================================= */

function doMove(
  x,
  y
) {

  if (!game)
    return;


  const r =
    game.place(x, y);


  if (!r.ok) {

    addLog(
      r.code
        ? t('err.' + r.code)
        : r.msg,
      'error'
    );

    return;
  }


  sendMessage({
    type: 'move',
    result: r
  });


  updateUI();

  drawBoard();

  saveGameToStorage();


  window.GoSound?.play(
    r.captured && r.captured.length
      ? 'capture'
      : 'stone'
  );
}


/* =========================================================
   Local Pass
========================================================= */

function doPass() {

  if (!game)
    return;


  const r =
    game.pass();


  if (!r.ok)
    return;


  sendMessage({
    type: 'pass',
    result: r
  });


  updateUI();

  drawBoard();

  saveGameToStorage();
}


/* =========================================================
   New Game
========================================================= */

function doNewGame(
  fromRemote = false
) {

  if (!game)
    return;


  game.reset();

  pendingUndo = false;


  if (!fromRemote) {

    sendMessage({
      type: 'newGame'
    });
  }


  updateUI();

  drawBoard();

  saveGameToStorage();
}


/* =========================================================
   Send Message
========================================================= */

function sendMessage(msg) {

  const payload =
    JSON.stringify(msg);


  /*
   * 優先使用目前主要连接。
   */
  if (
    peerConn &&
    peerConn.open
  ) {

    try {

      peerConn.send(
        payload
      );

      return true;

    } catch (e) {

      console.warn(
        'peerConn.send failed',
        e
      );
    }
  }


  /*
   * 尝试其它连接。
   */
  for (
    const c
    of peerConnections
  ) {

    try {

      if (
        c &&
        c.open
      ) {

        c.send(payload);

        return true;
      }

    } catch (e) {}
  }


  return false;
}


/* =========================================================
   Undo
========================================================= */

function requestUndo() {

  if (
    !game ||
    game.history.length === 0
  ) {

    addLog(
      t('err.noUndo'),
      'error'
    );

    return;
  }


  if (mode === 'hotseat') {

    game.undo();

    updateUI();

    drawBoard();

    saveGameToStorage();

    return;
  }


  if (pendingUndo) {

    addLog(
      t('dyn.undoPending'),
      'warn'
    );

    return;
  }


  const last =
    game.history[
      game.history.length - 1
    ];


  if (
    last.move.p !==
    myColor
  ) {

    addLog(
      t('dyn.undoOwnOnly'),
      'error'
    );

    return;
  }


  const sent =
    sendMessage({
      type: 'undoRequest',
      player: myColor
    });


  if (!sent) {

    addLog(
      t('dyn.undoNoConn'),
      'error'
    );

    return;
  }


  pendingUndo = true;


  addLog(
    t('dyn.undoSent'),
    'system'
  );


  updateUI();
}


function onUndoRequest(
  fromColor
) {

  if (
    !game ||
    game.history.length === 0
  ) {
    return;
  }


  showModal(
    t('dyn.undoReqTitle'),
    t('dyn.undoReqBody'),
    agree => {

      if (agree) {

        game.undo();


        const state =
          game.getFullState();


        sendMessage({

          type: 'undoAccept',

          player: myColor,

          state
        });


        updateUI();

        drawBoard();

        saveGameToStorage();


        addLog(
          t('dyn.undoAgreedLog'),
          'good'
        );

      } else {

        sendMessage({

          type: 'undoReject',

          player: myColor
        });
      }
    }
  );
}


function onUndoAccept(msg) {

  pendingUndo = false;


  if (
    msg &&
    msg.state
  ) {

    game.loadFullState(
      msg.state
    );

  } else {

    game.undo();
  }


  updateUI();

  drawBoard();

  saveGameToStorage();


  addLog(
    t('dyn.undoAccepted'),
    'good'
  );
}


function onUndoReject() {

  pendingUndo = false;


  addLog(
    t('dyn.undoRejected'),
    'error'
  );


  updateUI();
}


/* =========================================================
   Update UI
========================================================= */

function updateUI() {

  if (!game)
    return;


  $('blackCaptures')
    .textContent =
    game.captures[BLACK];


  $('whiteCaptures')
    .textContent =
    game.captures[WHITE];


  $('blackCard')
    ?.classList.toggle(
      'active',
      !game.gameOver &&
      game.currentPlayer === BLACK
    );


  $('whiteCard')
    ?.classList.toggle(
      'active',
      !game.gameOver &&
      game.currentPlayer === WHITE
    );


  const txt =
    $('turnText');


  if (txt) {

    if (game.gameOver) {

      const score =
        game.calculateChineseScore(
          7.5
        );


      txt.textContent = t(
        'dyn.gameOver',
        {
          w:
            score.winner === BLACK
              ? t('player.black')
              : t('player.white'),
          d:
            score.diff.toFixed(1)
        }
      );

    } else {

      const name =
        game.currentPlayer === BLACK
          ? t('player.black')
          : t('player.white');


      txt.textContent =
        name +
        (
          mode !== 'hotseat'
            ? (
                myColor ===
                game.currentPlayer
                  ? t('dyn.turnYou')
                  : t('dyn.turnWait')
              )
            : ''
        );
    }
  }


  $('passBtn')
    .disabled =
    !canPlay();


  $('undoBtn')
    .disabled =
    !(
      game &&
      game.history.length > 0
    ) ||
    pendingUndo;
}


/* =========================================================
   Heartbeat
========================================================= */

function startHeartbeat() {

  stopHeartbeat();


  heartbeatTimer =
    setInterval(
      () => {

        if (
          !peerConn ||
          !peerConn.open
        ) {
          return;
        }


        try {

          peerConn.send(
            JSON.stringify({
              type: 'ping',
              timestamp: Date.now()
            })
          );

        } catch (e) {

          console.warn(
            'Heartbeat failed',
            e
          );
        }

      },
      15000
    );
}


function stopHeartbeat() {

  if (heartbeatTimer) {

    clearInterval(
      heartbeatTimer
    );

    heartbeatTimer = null;
  }
}


/* =========================================================
   Remove Connection
========================================================= */

function removeConnection(
  conn
) {

  if (!conn)
    return;


  peerConnections.delete(
    conn
  );


  if (
    peerConn === conn
  ) {

    peerConn = null;
  }
}


/* =========================================================
   Schedule Reconnect
========================================================= */

function scheduleReconnect() {

  if (
    manuallyLeaving ||
    opponentLeft ||
    mode !== 'p2p' ||
    !p2pRoomCode
  ) {
    return;
  }


  if (reconnectTimer)
    return;


  reconnectAttempts++;


  if (
    reconnectAttempts > 10
  ) {

    setConnStatus(
      t('net.fail'),
      'error'
    );


    addLog(
      t('net.failLog'),
      'error'
    );


    return;
  }


  const delay =
    Math.min(
      reconnectAttempts * 2000,
      10000
    );


  reconnectTimer =
    setTimeout(
      () => {

        reconnectTimer = null;

        reconnectToRoom();

      },
      delay
    );
}


/* =========================================================
   Reconnect
========================================================= */

async function reconnectToRoom() {

  if (
    manuallyLeaving ||
    opponentLeft ||
    !p2pRoomCode
  ) {
    return;
  }


  if (
    !peerLoaded &&
    !(await loadPeerJS())
  ) {

    scheduleReconnect();

    return;
  }


  setConnStatus(
    t('net.reconnecting', {
      n: reconnectAttempts
    }),
    'pending'
  );


  try {

    if (
      peerConn &&
      peerConn.open
    ) {

      setConnStatus(
        t('net.connected'),
        'ok'
      );

      return;
    }


    /*
     * 加入者主动连接房主。
     */
    if (!isHost) {

      if (!peerInst) {

        peerInst =
          new Peer({
            debug: 1,
            secure: true,
            port: 443,

            config: {
              iceServers: [
                {
                  urls:
                    'stun:stun.l.google.com:19302'
                }
              ]
            }
          });


        peerInst.on(
          'open',
          () => {

            reconnectToRoom();
          }
        );


        peerInst.on(
          'error',
          err => {

            console.warn(
              'Peer reconnect error',
              err
            );

            scheduleReconnect();
          }
        );

        return;
      }


      const conn =
        peerInst.connect(
          'GO-' +
          p2pRoomCode,
          {
            reliable: true
          }
        );


      peerConn = conn;

      peerConnections.add(
        conn
      );


      installConnHandlers(
        conn
      );


      return;
    }


    /*
     * 房主：
     *
     * 房主不主动 connect。
     * 等待对手重新连接。
     */
    setConnStatus(
      t('net.waitOpponent'),
      'pending'
    );

  } catch (e) {

    console.warn(
      'Reconnect failed',
      e
    );

    scheduleReconnect();
  }
}


/* =========================================================
   Connection Handlers
========================================================= */

function installConnHandlers(
  conn
) {

  if (!conn)
    return;


  /*
   * 防止重复安装。
   */
  if (
    conn.__goHandlersInstalled
  ) {
    return;
  }


  conn.__goHandlersInstalled =
    true;


  /*
   * 連線建立當下立即通知聊天模組掛上監聽，
   * 避免輪詢間隙漏接最早的訊息。
   */
  try {
    if (
      window.GoChat &&
      window.GoChat.hookConn
    ) {
      window.GoChat.hookConn(
        conn
      );
    }
  } catch (e) {}


  /* -------------------------------------------------------
     Data
  ------------------------------------------------------- */

  conn.on(
    'data',
    raw => {

      let m;


      try {

        m =
          typeof raw === 'string'
            ? JSON.parse(raw)
            : raw;

      } catch (e) {

        console.warn(
          'Invalid P2P message',
          e
        );

        return;
      }


      if (!m)
        return;


      /* Ping */

      if (
        m.type === 'ping'
      ) {

        try {

          if (conn.open) {

            conn.send(
              JSON.stringify({
                type: 'pong',
                timestamp:
                  Date.now()
              })
            );
          }

        } catch (e) {}

        return;
      }


      /* Pong */

      if (
        m.type === 'pong'
      ) {

        return;
      }


      /* ---------------------------------------------------
         对方主动离开
      --------------------------------------------------- */

      if (
        m.type === 'leave'
      ) {

        opponentLeft = true;

        stopHeartbeat();


        setConnStatus(
          t('net.oppLeft'),
          'error'
        );


        addLog(
          t('net.oppLeftLog'),
          'error'
        );


        return;
      }


      /* ---------------------------------------------------
         请求同步
      --------------------------------------------------- */

      if (
        m.type === 'requestSync'
      ) {

        if (
          isHost &&
          game &&
          conn.open
        ) {

          try {

            conn.send(
              JSON.stringify({

                type: 'syncState',

                state:
                  game.getFullState()
              })
            );

          } catch (e) {

            console.warn(
              'syncState send failed',
              e
            );
          }
        }

        return;
      }


      /* Move */

      if (
        m.type === 'move'
      ) {

        applyMoveRemote(
          m.result
        );

        return;
      }


      /* Pass */

      if (
        m.type === 'pass'
      ) {

        applyPassRemote(
          m.result
        );

        return;
      }


      /* New Game */

      if (
        m.type === 'newGame'
      ) {

        doNewGame(true);

        return;
      }


      /* Undo request */

      if (
        m.type ===
        'undoRequest'
      ) {

        onUndoRequest(
          m.player
        );

        return;
      }


      /* Undo accept */

      if (
        m.type ===
        'undoAccept'
      ) {

        onUndoAccept(m);

        return;
      }


      /* Undo reject */

      if (
        m.type ===
        'undoReject'
      ) {

        onUndoReject();

        return;
      }


      /* Full sync */

      if (
        m.type ===
        'syncState'
      ) {

        if (!game) {

          game =
            new GoGame(
              m.state.size
            );
        }


        game.loadFullState(
          m.state
        );


        updateUI();

        setupCanvas();

        drawBoard();

        saveGameToStorage();


        setConnStatus(
          t('net.connected'),
          'ok'
        );


        addLog(
          t('net.synced'),
          'good'
        );


        return;
      }
    }
  );


  /* -------------------------------------------------------
     Open
  ------------------------------------------------------- */

  conn.on(
    'open',
    () => {

      peerConn = conn;

      peerConnections.add(
        conn
      );


      opponentLeft = false;

      reconnectAttempts = 0;


      if (reconnectTimer) {

        clearTimeout(
          reconnectTimer
        );

        reconnectTimer = null;
      }


      setConnStatus(
        t('net.connected'),
        'ok'
      );


      startHeartbeat();


      /*
       * 要求对方同步棋盘。
       */
      try {

        conn.send(
          JSON.stringify({
            type: 'requestSync'
          })
        );

      } catch (e) {}
    }
  );


  /* -------------------------------------------------------
     Close
  ------------------------------------------------------- */

  conn.on(
    'close',
    () => {

      removeConnection(
        conn
      );


      /*
       * 收到明确 leave：
       * 不重连。
       */
      if (
        opponentLeft
      ) {

        return;
      }


      /*
       * 自己主动离开：
       * 不重连。
       */
      if (
        manuallyLeaving
      ) {

        return;
      }


      stopHeartbeat();


      setConnStatus(
        t('net.disconnected'),
        'pending'
      );


      addLog(
        t('net.interrupted'),
        'warn'
      );


      scheduleReconnect();
    }
  );


  /* -------------------------------------------------------
     Error
  ------------------------------------------------------- */

  conn.on(
    'error',
    error => {

      console.warn(
        'P2P connection error:',
        error
      );

      /*
       * error 不代表对手离开。
       * 交给 close / reconnect 处理。
       */
    }
  );
}


/* =========================================================
   PeerJS Load
========================================================= */

function loadPeerJS() {

  if (peerLoaded) {

    return Promise.resolve(
      true
    );
  }


  return new Promise(
    resolve => {

      const script =
        document.createElement(
          'script'
        );


      script.src =
        'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';


      script.onload =
        () => {

          peerLoaded = true;

          resolve(true);
        };


      script.onerror =
        () => {

          resolve(false);
        };


      document.head.appendChild(
        script
      );
    }
  );
}


/* =========================================================
   Room Code
========================================================= */

function genCode() {

  const chars =
    'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';


  let code = '';


  for (
    let i = 0;
    i < 6;
    i++
  ) {

    code +=
      chars[
        Math.floor(
          Math.random() *
          chars.length
        )
      ];
  }


  return code;
}


/* =========================================================
   Host Room
========================================================= */

async function peerHostRoom(
  size
) {

  isHost = true;

  manuallyLeaving = false;

  opponentLeft = false;

  reconnectAttempts = 0;


  const code =
    genCode();


  if (peerInst) {

    try {
      peerInst.destroy();
    } catch (e) {}

    peerInst = null;
  }


  if (
    !peerLoaded &&
    !(await loadPeerJS())
  ) {

    setP2PStatus(
      'host',
      t('net.peerFail'),
      'error'
    );

    return;
  }


  p2pRoomCode =
    code;


  /*
   * 房主先创建棋盘，
   * 但不进入游戏页面。
   */
  game =
    new GoGame(size);


  peerInst =
    new Peer(
      'GO-' + code,
      {
        debug: 1,

        secure: true,

        port: 443,

        config: {
          iceServers: [
            {
              urls:
                'stun:stun.l.google.com:19302'
            }
          ]
        }
      }
    );


  /* Peer Open */

  peerInst.on(
    'open',
    id => {

      $('p2pRoomCode').value =
        code;


      setP2PStatus(
        'host',
        t('net.roomCreated', {
          c: code
        }),
        'ok'
      );
    }
  );


  /* Peer connection */

  peerInst.on(
    'connection',
    conn => {

      /*
       * 如果已经有旧连接，
       * 先关闭旧连接。
       */
      if (
        peerConn &&
        peerConn !== conn
      ) {

        try {
          peerConn.close();
        } catch (e) {}

        removeConnection(
          peerConn
        );
      }


      peerConn = conn;

      peerConnections.add(
        conn
      );


      installConnHandlers(
        conn
      );


      conn.on(
        'open',
        () => {

          opponentLeft = false;

          reconnectAttempts = 0;


          setConnStatus(
            t('net.oppConnected'),
            'ok'
          );


          startHeartbeat();


          /*
           * 进入游戏。
           */
          startGame(
            'p2p',
            size,
            BLACK
          );


          addLog(
            t('net.oppJoined'),
            'good'
          );


          /*
           * 发送完整棋盘。
           */
          try {

            conn.send(
              JSON.stringify({

                type:
                  'syncState',

                state:
                  game.getFullState()
              })
            );

          } catch (e) {}
        }
      );
    }
  );


  /* Peer disconnected */

  peerInst.on(
    'disconnected',
    () => {

      if (
        manuallyLeaving
      ) {
        return;
      }


      setConnStatus(
        t('net.recovering'),
        'pending'
      );


      addLog(
        t('net.rebuilding'),
        'warn'
      );


      try {

        peerInst.reconnect();

      } catch (e) {

        console.warn(
          'Peer reconnect failed',
          e
        );

        setTimeout(
          () => {

            try {

              if (
                peerInst &&
                !peerInst.destroyed
              ) {

                peerInst.reconnect();
              }

            } catch (err) {}
          },
          3000
        );
      }
    }
  );


  /* Peer error */

  peerInst.on(
    'error',
    error => {

      console.warn(
        'PeerJS error:',
        error
      );


      /*
       * 不要把 error 直接当成对手离开。
       */
      if (
        error &&
        error.type ===
        'network'
      ) {

        setConnStatus(
          t('net.netErr'),
          'pending'
        );
      }
    }
  );


  /* Peer close */

  peerInst.on(
    'close',
    () => {

      if (
        manuallyLeaving
      ) {
        return;
      }


      console.warn(
        'PeerJS instance closed'
      );
    }
  );
}


/* =========================================================
   Join Room
========================================================= */

async function peerJoinRoom(
  code
) {

  isHost = false;

  manuallyLeaving = false;

  opponentLeft = false;

  reconnectAttempts = 0;


  code =
    code
      .toUpperCase()
      .trim();


  p2pRoomCode =
    code;


  setP2PStatus(
    'join',
    t('net.joining', {
      c: code
    }),
    'pending'
  );


  if (peerInst) {

    try {
      peerInst.destroy();
    } catch (e) {}

    peerInst = null;
  }


  if (
    !peerLoaded &&
    !(await loadPeerJS())
  ) {

    setP2PStatus(
      'join',
      t('net.peerFail'),
      'error'
    );

    return;
  }


  peerInst =
    new Peer({
      debug: 1,

      secure: true,

      port: 443,

      config: {
        iceServers: [
          {
            urls:
              'stun:stun.l.google.com:19302'
          }
        ]
      }
    });


  peerInst.on(
    'open',
    () => {

      connectToHost();
    }
  );


  peerInst.on(
    'disconnected',
    () => {

      if (
        manuallyLeaving
      ) {
        return;
      }


      setConnStatus(
        t('net.recovering'),
        'pending'
      );


      addLog(
        t('net.rebuilding'),
        'warn'
      );


      try {

        peerInst.reconnect();

      } catch (e) {

        scheduleReconnect();
      }
    }
  );


  peerInst.on(
    'error',
    error => {

      console.warn(
        'Join PeerJS error:',
        error
      );


      if (
        error &&
        (
          error.type ===
          'peer-unavailable' ||
          error.type ===
          'network'
        )
      ) {

        scheduleReconnect();
      }
    }
  );
}


/* =========================================================
   Connect To Host
========================================================= */

function connectToHost() {

  if (
    manuallyLeaving ||
    opponentLeft ||
    !peerInst ||
    !p2pRoomCode
  ) {
    return;
  }


  if (
    peerConn &&
    peerConn.open
  ) {
    return;
  }


  const conn =
    peerInst.connect(
      'GO-' +
      p2pRoomCode,
      {
        reliable: true
      }
    );


  peerConn = conn;

  peerConnections.add(
    conn
  );


  installConnHandlers(
    conn
  );


  conn.on(
    'open',
    () => {

      /*
       * 加入者执白。
       */
      myColor = WHITE;

      mode = 'p2p';


      if (!game) {

        game =
          new GoGame(19);
      }


      lobby
        ?.classList.add(
          'hidden'
        );


      gameScreen
        ?.classList.remove(
          'hidden'
        );


      $('connMode').textContent =
        t('game.modeP2p');


      $('myRole').textContent =
        t('dyn.roleWhite');


      setConnStatus(
        t('net.joined'),
        'ok'
      );


      startHeartbeat();


      addLog(
        t('net.joinedSync'),
        'good'
      );


      reconnectAttempts = 0;


      setTimeout(
        () => {

          setupCanvas();

          drawBoard();

        },
        100
      );


      /*
       * 请求房主同步。
       */
      try {

        conn.send(
          JSON.stringify({
            type: 'requestSync'
          })
        );

      } catch (e) {}
    }
  );
}


/* =========================================================
   Leave Game
========================================================= */

function leaveGame() {

  manuallyLeaving = true;

  opponentLeft = false;


  stopHeartbeat();


  if (reconnectTimer) {

    clearTimeout(
      reconnectTimer
    );

    reconnectTimer = null;
  }


  /*
   * 明确通知对手：
   * 这是主动离开。
   */
  if (
    peerConn &&
    peerConn.open
  ) {

    try {

      peerConn.send(
        JSON.stringify({
          type: 'leave'
        })
      );

    } catch (e) {}
  }


  /*
   * 给消息一点时间发送。
   */
  setTimeout(
    () => {

      if (peerInst) {

        try {
          peerInst.destroy();
        } catch (e) {}

        peerInst = null;
      }


      peerConnections.clear();

      peerConn = null;

      game = null;

      mode = null;

      p2pRoomCode = null;

      isHost = false;

      myColor = BLACK;

      pendingUndo = false;

      hoverPos = null;


      clearSavedGame();


      gameScreen
        ?.classList.add(
          'hidden'
        );


      lobby
        ?.classList.remove(
          'hidden'
        );


      showLobbyHome();


      updateBoardSizeUI();

    },
    150
  );
}


/* =========================================================
   Page Visibility
========================================================= */

document.addEventListener(
  'visibilitychange',
  () => {

    if (
      document.visibilityState ===
      'visible'
    ) {

      /*
       * 回到页面时检查连接。
       */
      if (
        mode === 'p2p' &&
        !manuallyLeaving &&
        !opponentLeft
      ) {

        if (
          peerInst &&
          peerInst.disconnected
        ) {

          try {
            peerInst.reconnect();
          } catch (e) {}
        }


        if (
          !peerConn ||
          !peerConn.open
        ) {

          scheduleReconnect();
        }
      }


      if (game) {

        setTimeout(
          () => {

            setupCanvas();

            drawBoard();

          },
          100
        );
      }
    }
  }
);


/* =========================================================
   Keyboard
========================================================= */

document.addEventListener(
  'keydown',
  e => {

    /*
     * ESC 关闭 modal
     */
    if (
      e.key === 'Escape'
    ) {

      const overlay =
        $('modalOverlay');


      if (
        overlay &&
        !overlay.classList.contains(
          'hidden'
        )
      ) {

        closeModal();
      }
    }
  }
);


/* =========================================================
   Initial UI
========================================================= */

updateBoardSizeUI();


/* =========================================================
   i18n: 初始狀態文字（之後由各狀態函式動態覆寫）
========================================================= */

$('connMode').textContent =
  t('game.modeLocal');

$('connStatus').textContent =
  t('net.connected');

$('p2pHostStatus').textContent =
  t('host.connecting');

$('p2pJoinStatus').textContent =
  t('join.waiting');


/* =========================================================
   i18n: 語言切換時刷新對局中的動態文字
========================================================= */

window.addEventListener(
  'go:langchange',
  () => {

    if (
      !gameScreen ||
      gameScreen.classList.contains(
        'hidden'
      )
    ) {
      return;
    }


    $('connMode').textContent =
      mode === 'hotseat'
        ? t('game.modeLocal')
        : t('game.modeP2p');


    $('myRole').textContent =
      mode === 'hotseat'
        ? t('dyn.roleShared')
        : (
            myColor === BLACK
              ? t('dyn.roleBlack')
              : t('dyn.roleWhite')
          );


    updateUI();
  }
);