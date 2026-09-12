const EMPTY = 0, BLACK = 1, WHITE = 2;

/* 版本標記:打開瀏覽器控制台可確認目前載入的代碼版本 */
console.info(
  '%c線上圍棋 UI v2026-09-12-r3(虛手計數由棋譜推導)',
  'font-weight:bold;color:#2e6fe0'
);

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
    this.dead = new Set();
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


  consecutivePasses() {

    /*
     * 連續虛手數永遠由歷史推導:
     * 結尾有幾筆虛手就是幾。
     * 計數器不再自行累加,
     * 任何來源的污染都會在此自癒。
     */
    let n = 0;

    for (
      let i = this.history.length - 1;
      i >= 0;
      i--
    ) {

      const h =
        this.history[i];

      if (h.move && h.move.pass) {
        n++;
      } else {
        break;
      }
    }

    return n;
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

    /*
     * 記錄「落子前」的劫點與虛手數:
     * undo 還原時必須回到前一手當下的狀態,
     * 否則劫爭限制會遺失、虛手計數會歸零錯誤。
     */
    const previousKo =
      this.koPoint
        ? { ...this.koPoint }
        : null;

    const previousPassCount =
      this.passCount;

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

      koPoint: previousKo,

      passCount: previousPassCount
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


    this.history.push({

      hash: this.hash(),

      move: {
        pass: true,
        p: passingPlayer
      },

      captured: [],

      /*
       * push 當下 this.koPoint 還是虛手前的值:
       * 記下來,undo 還原後劫爭限制才不會消失
       */
      koPoint:
        this.koPoint
          ? { ...this.koPoint }
          : null
    });


    this.koPoint = null;
    this.lastMove = null;


    this.currentPlayer =
      this.currentPlayer === BLACK
        ? WHITE
        : BLACK;


    this.passCount =
      this.consecutivePasses();


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


      this.passCount =
        this.consecutivePasses();

    } else {

      this.currentPlayer =
        last.move.p;

      this.passCount =
        this.consecutivePasses();

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
    this.dead = new Set();
  }


  toggleDead(x, y) {

    /*
     * 終局點目:整組棋子共同死活。
     * 僅在雙虛手終局後可用。
     */
    if (!this.gameOver)
      return false;

    if (this.board[x][y] === EMPTY)
      return false;

    const grp =
      this.group(x, y);

    const isDead =
      this.dead.has(`${x},${y}`);

    for (const [sx, sy] of grp.stones) {

      const key =
        `${sx},${sy}`;

      if (isDead) {
        this.dead.delete(key);
      } else {
        this.dead.add(key);
      }
    }

    return true;
  }


  calculateChineseScore(
    komi = 7.5
  ) {

    const size = this.size;


    /*
     * 終局點目:被標記的死子視同已提清——
     * 不計子,其空點由領地泛洪自動歸給對方
     */
    const eff =
      this.board.map((row, x) =>
        row.map((c, y) =>
          c !== EMPTY &&
          this.dead.has(`${x},${y}`)
            ? EMPTY
            : c
        )
      );


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

        if (eff[x][y] === BLACK)
          blackStones++;

        else if (eff[x][y] === WHITE)
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
              eff[nx][ny];


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
        this.gameOver,

      dead:
        [...this.dead]
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


    /*
     * 連續虛手由歷史推導:
     * 同步過來的污染或過期計數在此自癒
     */
    this.passCount =
      this.consecutivePasses();


    this.gameOver =
      !!s.gameOver;


    this.dead =
      new Set(s.dead || []);
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

let ctx =
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

/* 觀戰:所有觀戰者連線 + 本次加入身份('play' | 'spectate') */
let spectatorConns = new Set();

let joinRole = 'play';


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

/* 目前連線狀態(記下可反查的詞條,語言切換時重繪) */
let connStatusRef = null;
let p2pStatusRef = null;

function setConnStatus(
  text,
  cls = 'ok'
) {

  const s =
    $('connStatus');

  if (!s)
    return;


  connStatusRef = {
    key:
      window.I18N
        ? I18N.keyOf(text)
        : null,
    which: null,
    text,
    cls
  };


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


  p2pStatusRef = {
    key:
      window.I18N
        ? I18N.keyOf(text)
        : null,
    which,
    text,
    cls
  };


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


  /* 觀戰者永遠不能落子 */
  if (mode === 'spectate')
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

        /*
         * 終局點目:死子加紅點標記
         */
        if (
          game.dead &&
          game.dead.has(`${x},${y}`)
        ) {

          const dcx =
            margin +
            x * cellSize;

          const dcy =
            margin +
            y * cellSize;

          ctx.fillStyle =
            'rgba(231,76,60,0.6)';

          ctx.beginPath();

          ctx.arc(
            dcx,
            dcy,
            cellSize * 0.16,
            0,
            Math.PI * 2
          );

          ctx.fill();
        }
      }
    }
  }


  /* Last move */

  const markerStyle =
    window.GoSettings?.get?.().marker || 'ring';

  if (game.lastMove && markerStyle === 'ring') {

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


  /* 最後一手標記:動態樣式(pulse/blink/spin)
     交給特效覆蓋層逐格驅動 */
  window.GoFX?.setMarker(
    markerStyle,
    game.lastMove
      ? { x: game.lastMove.x, y: game.lastMove.y }
      : null
  );


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

      const c =
        mode === 'hotseat'
          ? game.currentPlayer
          : myColor;


      /* 落子預覽:以半透明的當前皮膚棋子呈現 */
      ctx.save();

      ctx.globalAlpha = 0.45;

      drawStone(x, y, c);

      ctx.restore();
    }
  }
}


/* =========================================================
   Draw Stone
========================================================= */

/* =========================================================
   皮膚渲染器註冊表:新增皮膚只需
   寫一個 draw 函數並在此註冊
========================================================= */

const SKIN_RENDERERS = {
  pig: drawPigStone,
  shiba: drawShibaStone,
  cat: drawCatStone,
  panda: drawPandaStone,
  galaxy: drawGalaxyStone,
  math: drawMathStone
};


function drawStone(
  x,
  y,
  c,
  forceSkin
) {

  /*
   * 皮膚系統:每套皮膚以成對配色區分黑白。
   * forceSkin:預覽用,強制指定皮膚
   */
  const skin =
    forceSkin ||
    window.GoSettings?.get?.().skin ||
    'classic';

  const renderer =
    SKIN_RENDERERS[skin];

  if (renderer) {

    renderer(x, y, c);

    return;
  }

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
   Draw Pig Stone(小豬皮膚:成對絨毛豬)
   白方 = 粉紅絨毛豬 / 黑方 = 巧克力絨毛豬
========================================================= */

function drawPigStone(
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

  const white =
    c === WHITE;

  /* 成對配色:同一隻豬、兩種毛色 */
  const furLight = white ? '#ffdce4' : '#cf9f74';
  const furMid   = white ? '#ffb3c6' : '#b07c53';
  const furDeep  = white ? '#f0809f' : '#7e5335';
  const earIn    = white ? '#ff8fae' : '#9c6b47';
  const snout    = white ? '#ffd6df' : '#c99c74';
  const ink      = white ? '#5c3344' : '#382416';

  ctx.save();

  /* 柔軟絨毛投影 */
  ctx.shadowColor =
    white
      ? 'rgba(150,40,70,0.30)'
      : 'rgba(40,20,10,0.35)';

  ctx.shadowBlur =
    cellSize * 0.13;

  ctx.shadowOffsetY =
    cellSize * 0.05;

  /* 身體:三段漸層的絨毛球 */
  const body =
    ctx.createRadialGradient(
      cx - r * 0.32,
      cy - r * 0.38,
      r * 0.12,
      cx,
      cy,
      r
    );

  body.addColorStop(0, furLight);
  body.addColorStop(0.55, furMid);
  body.addColorStop(1, furDeep);

  ctx.fillStyle =
    body;

  ctx.beginPath();

  ctx.arc(
    cx,
    cy,
    r * 0.97,
    0,
    Math.PI * 2
  );

  ctx.fill();

  ctx.shadowColor =
    'transparent';

  /* 絨毛邊:細毛讓球看起來毛絨絨(小棋盤自動省略) */
  if (cellSize >= 24) {

    ctx.strokeStyle =
      furLight;

    ctx.globalAlpha = 0.55;
    ctx.lineWidth =
      Math.max(1, r * 0.05);

    const ticks = 16;

    for (let i = 0; i < ticks; i++) {

      const a =
        (i / ticks) * Math.PI * 2 + 0.18;

      ctx.beginPath();

      ctx.moveTo(
        cx + Math.cos(a) * r * 0.95,
        cy + Math.sin(a) * r * 0.95
      );

      ctx.lineTo(
        cx + Math.cos(a) * r * 1.05,
        cy + Math.sin(a) * r * 1.05
      );

      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }


  /* 耳朵:圓潤三角 + 內耳(成對出現在頭頂兩側) */
  const ear =
    (bx, by, side, scale, fill) => {

      ctx.fillStyle =
        fill;

      ctx.beginPath();

      ctx.moveTo(
        bx - side * r * 0.16 * scale,
        by + r * 0.10 * scale
      );

      ctx.quadraticCurveTo(
        bx + side * r * 0.10 * scale,
        by - r * 0.30 * scale,
        bx + side * r * 0.27 * scale,
        by - r * 0.05 * scale
      );

      ctx.quadraticCurveTo(
        bx + side * r * 0.21 * scale,
        by + r * 0.17 * scale,
        bx - side * r * 0.16 * scale,
        by + r * 0.10 * scale
      );

      ctx.closePath();

      ctx.fill();
    };

  for (const side of [-1, 1]) {

    const bx =
      cx + side * r * 0.46;

    const by =
      cy - r * 0.40;

    ear(bx, by, side, 1, furMid);

    ear(
      bx + side * r * 0.03,
      by + r * 0.03,
      side,
      0.55,
      earIn
    );
  }


  /* 腮紅 */
  ctx.fillStyle =
    white
      ? 'rgba(255,110,145,0.40)'
      : 'rgba(205,95,60,0.35)';

  for (const side of [-1, 1]) {

    ctx.beginPath();

    ctx.arc(
      cx + side * r * 0.44,
      cy + r * 0.12,
      r * 0.13,
      0,
      Math.PI * 2
    );

    ctx.fill();
  }


  /* 眼睛:圓點 + 高光 */
  for (const side of [-1, 1]) {

    ctx.fillStyle =
      ink;

    ctx.beginPath();

    ctx.arc(
      cx + side * r * 0.33,
      cy - r * 0.06,
      r * 0.085,
      0,
      Math.PI * 2
    );

    ctx.fill();

    ctx.fillStyle =
      'rgba(255,255,255,0.9)';

    ctx.beginPath();

    ctx.arc(
      cx + side * r * 0.355,
      cy - r * 0.09,
      r * 0.028,
      0,
      Math.PI * 2
    );

    ctx.fill();
  }


  /* 豬鼻:橢圓 + 兩個鼻孔 */
  const ny =
    cy + r * 0.24;

  ctx.fillStyle =
    snout;

  ctx.beginPath();

  ctx.ellipse(
    cx,
    ny,
    r * 0.30,
    r * 0.21,
    0,
    0,
    Math.PI * 2
  );

  ctx.fill();

  ctx.strokeStyle =
    'rgba(0,0,0,0.14)';

  ctx.lineWidth =
    Math.max(1, r * 0.03);

  ctx.stroke();

  ctx.fillStyle =
    ink;

  for (const side of [-1, 1]) {

    ctx.beginPath();

    ctx.ellipse(
      cx + side * r * 0.115,
      ny,
      r * 0.045,
      r * 0.075,
      0,
      0,
      Math.PI * 2
    );

    ctx.fill();
  }


  /* 頂部柔光,增加蓬鬆感 */
  ctx.fillStyle =
    'rgba(255,255,255,0.18)';

  ctx.beginPath();

  ctx.ellipse(
    cx - r * 0.22,
    cy - r * 0.42,
    r * 0.34,
    r * 0.20,
    -0.5,
    0,
    Math.PI * 2
  );

  ctx.fill();


  ctx.restore();
}


/* =========================================================
   絨毛底共用:柔和漸層身體 + 細毛
========================================================= */

function plushBody(
  cx, cy, r,
  light, mid, deep,
  shadow
) {

  ctx.save();

  ctx.shadowColor = shadow;
  ctx.shadowBlur = cellSize * 0.13;
  ctx.shadowOffsetY = cellSize * 0.05;

  const body =
    ctx.createRadialGradient(
      cx - r * 0.32,
      cy - r * 0.38,
      r * 0.12,
      cx, cy, r
    );

  body.addColorStop(0, light);
  body.addColorStop(0.55, mid);
  body.addColorStop(1, deep);

  ctx.fillStyle = body;

  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.97, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.restore();
}


function plushTicks(cx, cy, r, color) {

  if (cellSize < 24)
    return;

  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = Math.max(1, r * 0.05);

  const ticks = 16;

  for (let i = 0; i < ticks; i++) {

    const a =
      (i / ticks) * Math.PI * 2 + 0.18;

    ctx.beginPath();
    ctx.moveTo(
      cx + Math.cos(a) * r * 0.95,
      cy + Math.sin(a) * r * 0.95
    );
    ctx.lineTo(
      cx + Math.cos(a) * r * 1.05,
      cy + Math.sin(a) * r * 1.05
    );
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
}


/* =========================================================
   皮膚:柴犬(白方 = 橘柴 / 黑方 = 灰柴)
========================================================= */

function drawShibaStone(x, y, c) {

  const cx = margin + x * cellSize;
  const cy = margin + y * cellSize;
  const r = cellSize * 0.46;
  const white = c === WHITE;

  const furLight = white ? '#ffd39c' : '#d3dbe3';
  const furMid   = white ? '#f39c50' : '#96a2af';
  const furDeep  = white ? '#d87c31' : '#6d7885';
  const earIn    = white ? '#ffbf87' : '#8b97a4';
  const muzzle   = white ? '#fff3e0' : '#f4f7fa';
  const ink      = white ? '#4a2c15' : '#2b333c';

  plushBody(cx, cy, r, furLight, furMid, furDeep,
    white ? 'rgba(160,80,20,0.30)' : 'rgba(30,40,50,0.32)');
  plushTicks(cx, cy, r, furLight);

  /* 立耳 */
  const tri = (bx, by, side, scale, fill) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(bx - side * r * 0.18 * scale, by + r * 0.12 * scale);
    ctx.quadraticCurveTo(bx + side * r * 0.02 * scale, by - r * 0.42 * scale,
      bx + side * r * 0.30 * scale, by - r * 0.02 * scale);
    ctx.quadraticCurveTo(bx + side * r * 0.20 * scale, by + r * 0.16 * scale,
      bx - side * r * 0.18 * scale, by + r * 0.12 * scale);
    ctx.closePath();
    ctx.fill();
  };

  for (const side of [-1, 1]) {
    const bx = cx + side * r * 0.48;
    const by = cy - r * 0.42;
    tri(bx, by, side, 1, furMid);
    tri(bx + side * r * 0.02, by + r * 0.02, side, 0.55, earIn);
  }

  /* 口鼻區 */
  ctx.fillStyle = muzzle;
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.24, r * 0.40, r * 0.30, 0, 0, Math.PI * 2);
  ctx.fill();

  /* 眼睛 */
  for (const side of [-1, 1]) {
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.arc(cx + side * r * 0.31, cy - r * 0.10, r * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(cx + side * r * 0.33, cy - r * 0.13, r * 0.026, 0, Math.PI * 2);
    ctx.fill();
  }

  /* 鼻 */
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.10, r * 0.10, r * 0.075, 0, 0, Math.PI * 2);
  ctx.fill();

  /* 嘴 */
  ctx.strokeStyle = ink;
  ctx.lineWidth = Math.max(1, r * 0.035);
  ctx.beginPath();
  ctx.arc(cx - r * 0.055, cy + r * 0.16, r * 0.06, 0.1, Math.PI - 0.4);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx + r * 0.055, cy + r * 0.16, r * 0.06, 0.4, Math.PI - 0.1);
  ctx.stroke();
}


/* =========================================================
   皮膚:貓咪(白方 = 白貓 / 黑方 = 黑貓)
========================================================= */

function drawCatStone(x, y, c) {

  const cx = margin + x * cellSize;
  const cy = margin + y * cellSize;
  const r = cellSize * 0.46;
  const white = c === WHITE;

  const furLight = white ? '#ffffff' : '#6a6a7a';
  const furMid   = white ? '#eef1f5' : '#4a4a5a';
  const furDeep  = white ? '#cfd6de' : '#31313d';
  const earIn    = white ? '#ffc9d6' : '#8a5a68';
  const eyeCol   = white ? '#3aa0d8' : '#f5c542';
  const ink      = white ? '#2a2f36' : '#101018';
  const whisker  = white ? 'rgba(130,140,150,0.6)' : 'rgba(230,230,240,0.55)';

  plushBody(cx, cy, r, furLight, furMid, furDeep,
    white ? 'rgba(70,90,110,0.30)' : 'rgba(0,0,0,0.4)');
  plushTicks(cx, cy, r, furLight);

  /* 尖耳 */
  const tri = (bx, by, side, scale, fill) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(bx - side * r * 0.16 * scale, by + r * 0.14 * scale);
    ctx.quadraticCurveTo(bx + side * r * 0.0 * scale, by - r * 0.48 * scale,
      bx + side * r * 0.26 * scale, by - r * 0.04 * scale);
    ctx.quadraticCurveTo(bx + side * r * 0.18 * scale, by + r * 0.16 * scale,
      bx - side * r * 0.16 * scale, by + r * 0.14 * scale);
    ctx.closePath();
    ctx.fill();
  };

  for (const side of [-1, 1]) {
    const bx = cx + side * r * 0.46;
    const by = cy - r * 0.44;
    tri(bx, by, side, 1, furMid);
    tri(bx + side * r * 0.02, by + r * 0.02, side, 0.5, earIn);
  }

  /* 眼睛:瞳孔呈直線 */
  for (const side of [-1, 1]) {
    ctx.fillStyle = eyeCol;
    ctx.beginPath();
    ctx.ellipse(cx + side * r * 0.32, cy - r * 0.06, r * 0.095, r * 0.11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.ellipse(cx + side * r * 0.32, cy - r * 0.06, r * 0.032, r * 0.10, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  /* 鼻 */
  ctx.fillStyle = earIn;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.06, cy + r * 0.14);
  ctx.lineTo(cx + r * 0.06, cy + r * 0.14);
  ctx.lineTo(cx, cy + r * 0.235);
  ctx.closePath();
  ctx.fill();

  /* 鬍鬚 */
  if (cellSize >= 22) {
    ctx.strokeStyle = whisker;
    ctx.lineWidth = Math.max(0.8, r * 0.035);
    for (const side of [-1, 1]) {
      for (const dy of [-0.05, 0.03, 0.11]) {
        ctx.beginPath();
        ctx.moveTo(cx + side * r * 0.30, cy + r * dy + r * 0.12);
        ctx.lineTo(cx + side * r * 0.74, cy + r * (dy - 0.10) + r * 0.12);
        ctx.stroke();
      }
    }
  }
}


/* =========================================================
   皮膚:貓熊(白方 = 經典貓熊 / 黑方 = 棕貓熊)
========================================================= */

function drawPandaStone(x, y, c) {

  const cx = margin + x * cellSize;
  const cy = margin + y * cellSize;
  const r = cellSize * 0.46;
  const white = c === WHITE;

  const faceLight = white ? '#ffffff' : '#ecd0a8';
  const faceDeep  = white ? '#e4e7ec' : '#d4b184';
  const patch     = white ? '#26282e' : '#54402f';
  const eyeDot    = white ? '#ffffff' : '#f7ecd9';
  const nose      = white ? '#26282e' : '#453324';

  plushBody(cx, cy, r, faceLight, faceLight, faceDeep,
    white ? 'rgba(40,44,52,0.30)' : 'rgba(70,50,30,0.32)');

  /* 耳朵:圓耳 */
  for (const side of [-1, 1]) {
    ctx.fillStyle = patch;
    ctx.beginPath();
    ctx.arc(cx + side * r * 0.52, cy - r * 0.50, r * 0.26, 0, Math.PI * 2);
    ctx.fill();
  }

  /* 黑眼圈:斜橢圓 */
  for (const side of [-1, 1]) {
    ctx.fillStyle = patch;
    ctx.beginPath();
    ctx.ellipse(cx + side * r * 0.32, cy - r * 0.10, r * 0.19, r * 0.26, side * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  /* 眼睛:眼圈內的小亮點 */
  for (const side of [-1, 1]) {
    ctx.fillStyle = eyeDot;
    ctx.beginPath();
    ctx.arc(cx + side * r * 0.34, cy - r * 0.13, r * 0.055, 0, Math.PI * 2);
    ctx.fill();
  }

  /* 鼻 */
  ctx.fillStyle = nose;
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.22, r * 0.11, r * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();

  /* 嘴 */
  ctx.strokeStyle = nose;
  ctx.lineWidth = Math.max(1, r * 0.035);
  ctx.beginPath();
  ctx.moveTo(cx, cy + r * 0.30);
  ctx.quadraticCurveTo(cx, cy + r * 0.38, cx - r * 0.08, cy + r * 0.40);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy + r * 0.30);
  ctx.quadraticCurveTo(cx, cy + r * 0.38, cx + r * 0.08, cy + r * 0.40);
  ctx.stroke();
}


/* =========================================================
   皮膚:星空(白方 = 深藍星雲 / 黑方 = 紫粉星雲)
========================================================= */

const GALAXY_STARS = [
  [0.4, 0.52, 0.05, 0.9],
  [1.15, 0.68, 0.035, 0.65],
  [1.9, 0.45, 0.05, 0.85],
  [2.6, 0.72, 0.032, 0.55],
  [3.35, 0.5, 0.055, 0.9],
  [4.1, 0.66, 0.038, 0.7],
  [4.9, 0.48, 0.045, 0.8],
  [5.65, 0.70, 0.032, 0.6]
];

function drawGalaxyStone(x, y, c) {

  const cx = margin + x * cellSize;
  const cy = margin + y * cellSize;
  const r = cellSize * 0.46;
  const white = c === WHITE;

  const halo = white ? 'rgba(140,200,255,0.9)' : 'rgba(230,160,255,0.9)';
  const planet = white ? '#bfe3ff' : '#f0c4ff';

  ctx.save();

  ctx.shadowColor = halo;
  ctx.shadowBlur = cellSize * 0.16;
  ctx.shadowOffsetY = cellSize * 0.04;

  const base =
    ctx.createRadialGradient(
      cx - r * 0.3,
      cy - r * 0.35,
      r * 0.1,
      cx, cy, r
    );

  if (white) {
    base.addColorStop(0, '#7fd4ff');
    base.addColorStop(0.55, '#2e6fe0');
    base.addColorStop(1, '#131f47');
  } else {
    base.addColorStop(0, '#e08aff');
    base.addColorStop(0.55, '#7a3fd4');
    base.addColorStop(1, '#22103e');
  }

  ctx.fillStyle = base;

  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.97, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowColor = 'transparent';

  /* 星星:固定位置,重繪不閃爍 */
  for (const [a, d, s, alpha] of GALAXY_STARS) {

    ctx.fillStyle =
      `rgba(255,255,255,${alpha})`;

    ctx.beginPath();
    ctx.arc(
      cx + Math.cos(a) * r * d,
      cy + Math.sin(a) * r * d,
      Math.max(0.8, r * s * 0.18),
      0, Math.PI * 2
    );
    ctx.fill();
  }

  /* 小行星:發光圓點 */
  ctx.fillStyle = planet;
  ctx.shadowColor = halo;
  ctx.shadowBlur = r * 0.25;

  ctx.beginPath();
  ctx.arc(
    cx + Math.cos(3.8) * r * 0.30,
    cy + Math.sin(3.8) * r * 0.30,
    r * 0.11,
    0, Math.PI * 2
  );
  ctx.fill();

  ctx.shadowColor = 'transparent';

  /* 光暈邊緣 */
  ctx.strokeStyle =
    white
      ? 'rgba(140,200,255,0.5)'
      : 'rgba(230,160,255,0.5)';

  ctx.lineWidth = Math.max(1, r * 0.05);
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.94, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}


/* =========================================================
   皮膚:數學(白方 = 方格紙 π / 黑方 = 黑板 Σ)
========================================================= */

function drawMathStone(x, y, c) {

  const cx = margin + x * cellSize;
  const cy = margin + y * cellSize;
  const r = cellSize * 0.46;
  const white = c === WHITE;

  ctx.save();

  ctx.shadowColor =
    white
      ? 'rgba(90,80,40,0.30)'
      : 'rgba(0,0,0,0.40)';

  ctx.shadowBlur = cellSize * 0.13;
  ctx.shadowOffsetY = cellSize * 0.05;

  /* 主體:紙張 / 黑板 */
  const body =
    ctx.createRadialGradient(
      cx - r * 0.3,
      cy - r * 0.35,
      r * 0.12,
      cx, cy, r
    );

  if (white) {
    body.addColorStop(0, '#fbf7ea');
    body.addColorStop(0.6, '#f1e9d2');
    body.addColorStop(1, '#ddd1b0');
  } else {
    body.addColorStop(0, '#3d5a4f');
    body.addColorStop(0.6, '#2c443c');
    body.addColorStop(1, '#1c2f29');
  }

  ctx.fillStyle = body;

  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.97, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowColor = 'transparent';

  if (white) {

    /* 方格紙:淡藍格線 */
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.9, 0, Math.PI * 2);
    ctx.clip();

    ctx.strokeStyle =
      'rgba(90,130,190,0.22)';

    ctx.lineWidth =
      Math.max(0.7, r * 0.03);

    for (let i = -2; i <= 2; i++) {

      const g = i * r * 0.42;

      ctx.beginPath();
      ctx.moveTo(cx + g, cy - r);
      ctx.lineTo(cx + g, cy + r);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(cx - r, cy + g);
      ctx.lineTo(cx + r, cy + g);
      ctx.stroke();
    }

    ctx.restore();

    /* 紙緣 */
    ctx.strokeStyle =
      'rgba(120,100,60,0.35)';

    ctx.lineWidth = Math.max(1, r * 0.05);

    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.92, 0, Math.PI * 2);
    ctx.stroke();

    /* π:石墨雙描,手寫感 */
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font =
      `italic bold ${Math.round(r * 0.95)}px Georgia, "Times New Roman", serif`;

    ctx.fillStyle =
      'rgba(58,58,69,0.35)';

    ctx.fillText(
      'π',
      cx + r * 0.04,
      cy + r * 0.10
    );

    ctx.fillStyle = '#3a3a45';

    ctx.fillText('π', cx, cy + r * 0.07);

    /* 角落小註記 */
    ctx.fillStyle = 'rgba(58,58,69,0.5)';
    ctx.font = `bold ${Math.round(r * 0.3)}px Georgia, serif`;
    ctx.fillText('+', cx - r * 0.58, cy - r * 0.44);
    ctx.fillText('=', cx + r * 0.56, cy + r * 0.52);

  } else {

    /* 黑板:粉筆殘跡 */
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.9, 0, Math.PI * 2);
    ctx.clip();

    ctx.strokeStyle = 'rgba(240,238,225,0.08)';
    ctx.lineWidth = r * 0.12;

    for (let i = 0; i < 3; i++) {

      ctx.beginPath();
      ctx.moveTo(
        cx - r + i * 4,
        cy - r * 0.2 + i * r * 0.5
      );
      ctx.lineTo(
        cx + r,
        cy - r * 0.4 + i * r * 0.5
      );
      ctx.stroke();
    }

    ctx.restore();

    /* 圓規虛線圈 */
    ctx.strokeStyle = 'rgba(242,240,230,0.5)';
    ctx.lineWidth = Math.max(0.8, r * 0.035);
    ctx.setLineDash([r * 0.08, r * 0.07]);

    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.72, 0, Math.PI * 2);
    ctx.stroke();

    ctx.setLineDash([]);

    /* Σ:粉筆白雙描 */
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font =
      `bold ${Math.round(r * 0.95)}px Georgia, "Times New Roman", serif`;

    ctx.fillStyle = 'rgba(242,240,230,0.35)';

    ctx.fillText(
      'Σ',
      cx + r * 0.04,
      cy + r * 0.08
    );

    ctx.fillStyle = '#f2f0e6';

    ctx.fillText('Σ', cx, cy + r * 0.05);

    /* 粉筆小十字 */
    ctx.strokeStyle = 'rgba(242,240,230,0.55)';
    ctx.lineWidth = Math.max(0.8, r * 0.04);

    const px = cx + r * 0.55;
    const py = cy - r * 0.42;
    const s = r * 0.09;

    ctx.beginPath();
    ctx.moveTo(px - s, py);
    ctx.lineTo(px + s, py);
    ctx.moveTo(px, py - s);
    ctx.lineTo(px, py + s);
    ctx.stroke();
  }

  ctx.restore();
}


/* =========================================================
   Skin Preview(皮膚預覽:在設置面板渲染
   每套皮膚的黑白成對棋子樣本)
========================================================= */

function renderStonePair(canvas, skin, halfOnly) {

  if (!canvas)
    return;

  const dpr =
    window.devicePixelRatio || 1;

  const w =
    canvas.clientWidth ||
    (halfOnly ? 56 : 320);

  const h =
    canvas.clientHeight ||
    (halfOnly ? 28 : 72);

  canvas.width =
    Math.round(w * dpr);

  canvas.height =
    Math.round(h * dpr);

  /*
   * 暫時切換繪圖環境,
   * 重用棋盤的 drawStone 繪製樣本
   */
  const saveCtx = ctx;
  const saveMargin = margin;
  const saveCell = cellSize;

  ctx = canvas.getContext('2d');

  ctx.scale(dpr, dpr);

  const wood =
    ctx.createLinearGradient(0, 0, 0, h);

  wood.addColorStop(0, '#e8c78f');
  wood.addColorStop(1, '#d3a75e');

  ctx.fillStyle = wood;
  ctx.fillRect(0, 0, w, h);

  margin = 0;

  if (halfOnly) {

    /*
     * 小預覽:兩子對放——
     * 黑子貼左緣露右半,白子貼右緣露左半,
     * 於中央相接,各自只露朝內的一邊
     */
    cellSize = h * 0.95;

    const rr =
      cellSize * 0.46;

    const cyT = h / 2;

    margin = w / 2 - rr;
    drawStone(0, (cyT - margin) / cellSize, BLACK, skin);

    margin = w / 2 + rr;
    drawStone(0, (cyT - margin) / cellSize, WHITE, skin);

  } else {

    /*
     * 大預覽:兩顆完整棋子並排置中
     */
    cellSize = h;

    const cyTarget = h / 2;

    /* 黑子(左) */
    margin = w * 0.25;
    drawStone(0, (cyTarget - margin) / cellSize, BLACK, skin);

    /* 白子(右) */
    margin = w * 0.75;
    drawStone(0, (cyTarget - margin) / cellSize, WHITE, skin);
  }

  ctx = saveCtx;
  margin = saveMargin;
  cellSize = saveCell;
}


function renderSkinPreviews() {

  /*
   * 縮圖:每套皮膚一張小樣本
   */
  document
    .querySelectorAll('#skinSeg .skin-thumb')
    .forEach(thumb => {

      renderStonePair(
        thumb.querySelector('canvas'),
        thumb.dataset.value,
        true
      );
    });

  updateSkinPreview();
}


function updateSkinPreview() {

  /*
   * 大預覽:當前選中皮膚的黑白成對棋子
   */
  renderStonePair(
    document.getElementById('skinPreviewMain'),
    window.GoSettings?.get?.().skin || 'classic'
  );

  updateSkinPreviewName();
}


function updateSkinPreviewName() {

  const nameEl =
    document.getElementById('skinPreviewName');

  if (nameEl) {

    nameEl.textContent =
      t('skin.' + (window.GoSettings?.get?.().skin || 'classic'));
  }
}


/*
 * 落子特效用:棋盤格座標 → canvas 像素(CSS px)
 */
function boardPoint(
  x,
  y
) {

  return {
    x: margin + x * cellSize,
    y: margin + y * cellSize,
    cell: cellSize
  };
}


window.GoBoard = {
  renderSkinPreviews,
  updateSkinPreview,
  updateSkinPreviewName,
  boardPoint
};


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

      } else if (
        mode !== 'spectate' &&
        game &&
        game.gameOver &&
        pos &&
        game.board[pos.x][pos.y] !==
        EMPTY
      ) {

        /*
         * 終局點目:點擊棋組標記/取消死子
         */
        if (
          game.toggleDead(
            pos.x,
            pos.y
          )
        ) {

          sendMessage({
            type: 'toggleDead',
            x: pos.x,
            y: pos.y
          });

          updateUI();

          drawBoard();
        }
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

      /*
       * 離開加入/觀戰畫面時必須銷毀
       * 還在握手中的連線,否則它完成連線後
       * 會把使用者強拉進對應的模式
       */
      if (peerInst) {

        try {
          peerInst.destroy();
        } catch (e) {}

        peerInst = null;
      }

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


$('submitSpectateBtn')
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

        peerSpectateRoom(v);

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

    /*
     * 單機模式絕不被殘留的連線流程劫持:
     * 銷毀任何還在背景握手的加入/觀戰連線
     */
    if (peerInst) {

      try {
        peerInst.destroy();
      } catch (e) {}

      peerInst = null;
    }

    spectatorConns.clear();

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


  /* 玩家模式:操作區可見 */
  document
    .querySelector(
      '.game-layout .actions'
    )
    ?.classList.remove(
      'hidden'
    );


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

  /*
   * 協議防護:落子結果不得帶 pass 標記,
   * 避免虛手訊息被誤當落子套用
   */
  if (
    !r ||
    !r.ok ||
    r.pass ||
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

      /* 提子特效:被提棋子顏色為落子方的對方 */
      window.GoFX?.capture(
        cx,
        cy,
        r.player === BLACK
          ? WHITE
          : BLACK
      );
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
    game.consecutivePasses();


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


  window.GoFX?.stone(
    r.x,
    r.y,
    r.player
  );


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

  /*
   * 協議防護:虛手結果必須帶 pass 標記,
   * 落子訊息誤入此處一律丟棄
   */
  if (!game || !r || !r.pass)
    return;


  addLog(
    t('log.pass', {
      p:
        r.passingPlayer === BLACK
          ? t('player.black')
          : t('player.white')
    })
  );


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
    game.consecutivePasses();


  if (r.gameOver) {

    game.gameOver =
      true;

    addLog(
      t('scoring.hint'),
      'system'
    );

    announceResult();
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


  if (!sendMessage({
    type: 'move',
    result: r
  })) {

    addLog(
      t('net.sendFailed'),
      'error'
    );
  }


  /* 提子特效:在每顆被提棋子的位置播放 */
  if (r.captured && r.captured.length) {

    const capturedColor =
      r.player === BLACK
        ? WHITE
        : BLACK;

    for (
      const [cx, cy]
      of r.captured
    ) {

      window.GoFX?.capture(
        cx,
        cy,
        capturedColor
      );
    }
  }


  if (r.gameOver) {

    addLog(
      t('scoring.hint'),
      'system'
    );

    announceResult();
  }


  updateUI();

  drawBoard();

  saveGameToStorage();

  window.GoFX?.stone(
    r.x,
    r.y,
    r.player
  );
}


/* =========================================================
   Announce Result(終局自動彈出勝負)
========================================================= */

function announceResult() {

  if (!game || !game.gameOver)
    return;

  const score =
    game.calculateChineseScore(
      7.5
    );

  const body =
    t('result.body', {
      w:
        score.winner === BLACK
          ? t('color.black')
          : t('color.white'),
      d:
        score.diff.toFixed(1),
      b: score.blackTotal,
      c: score.whiteTotal
    });

  addLog(
    body,
    'good'
  );

  showModal(
    t('result.title'),
    body,
    () => {}
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


  addLog(
    t('log.pass', {
      p:
        r.passingPlayer === BLACK
          ? t('player.black')
          : t('player.white')
    })
  );


  if (!sendMessage({
    type: 'pass',
    result: r
  })) {

    addLog(
      t('net.sendFailed'),
      'error'
    );
  }


  if (r.gameOver) {

    addLog(
      t('scoring.hint'),
      'system'
    );

    announceResult();
  }


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

  /* 觀戰者不能重置對局 */
  if (mode === 'spectate' && !fromRemote)
    return;


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

  /*
   * 單機模式:一切都在本機完成,
   * 訊息無需(也無法)發送
   */
  if (mode === 'hotseat') {
    return true;
  }

  const payload =
    JSON.stringify(msg);

  let sent = false;


  /*
   * 優先使用目前主要连接。
   * (不提早 return:後面的觀戰廣播
   *  必須繼續執行)
   */
  if (
    peerConn &&
    peerConn.open
  ) {

    try {

      peerConn.send(
        payload
      );

      sent = true;

    } catch (e) {

      console.warn(
        'peerConn.send failed',
        e
      );
    }
  }


  /*
   * 尝试其它连接。
   * (peerConn 已發過,跳過避免重複)
   */
  for (
    const c
    of peerConnections
  ) {

    try {

      if (
        c &&
        c.open &&
        c !== peerConn
      ) {

        c.send(payload);

        sent = true;
      }

    } catch (e) {}
  }


  /*
   * 對局訊息廣播給所有觀戰者,
   * 觀戰端自行過濾玩家間協商訊息
   */
  for (
    const c
    of spectatorConns
  ) {

    try {

      if (
        c &&
        c.open
      ) {

        c.send(payload);

        sent = true;
      }

    } catch (e) {}
  }


  /* 診斷:Console 過濾 [GO] 可追蹤訊息流 */
  if (msg.type !== 'ping' && msg.type !== 'pong') {
    console.info('[GO→]', msg.type, sent ? '✓' : '✗未送出', isHost ? '(房主)' : '(客端)');
  }


  return sent;
}


/* =========================================================
   Relay To Spectators
   (房主把玩家傳來的訊息轉發給觀戰者)
========================================================= */

function relayToSpectators(msg) {

  if (!isHost || !spectatorConns.size)
    return;

  const payload =
    JSON.stringify(msg);

  for (
    const c
    of spectatorConns
  ) {

    try {

      if (
        c &&
        c.open
      ) {

        c.send(payload);
      }

    } catch (e) {}
  }
}


/* =========================================================
   Undo
========================================================= */

function requestUndo() {

  /* 觀戰者不能發動悔棋 */
  if (mode === 'spectate')
    return;


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


      let suffix = '';

      if (mode === 'spectate') {

        suffix = t('turn.spectating');

      } else if (game.passCount === 1) {

        /*
         * 一方已虛手:提示再虛手一次即終局
         */
        suffix = t('turn.onePass');

      } else if (mode !== 'hotseat') {

        suffix =
          myColor === game.currentPlayer
            ? t('dyn.turnYou')
            : t('dyn.turnWait');
      }

      txt.textContent =
        name + suffix;
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
   Board Has Stones(盤上是否有值得續戰的局面)
========================================================= */

function boardHasStones(g) {

  if (!g)
    return false;

  for (let x = 0; x < g.size; x++) {

    for (let y = 0; y < g.size; y++) {

      if (g.board[x][y] !== EMPTY)
        return true;
    }
  }

  return false;
}


/* =========================================================
   Host Accept Player(收到 hello['play']
   或舊版客戶端的 requestSync 時接納玩家)
========================================================= */

function hostAcceptPlayer(conn) {

  if (!conn || conn.__goIsPlayer)
    return;

  conn.__goIsPlayer = true;

  console.info('[GO] 玩家已接納');


  /*
   * 新玩家加入時的棋局取捨:
   * - 上一個對手正常離開,或
   * - 盤上沒有棋子(空盤、只按過虛手的殘留狀態)
   * → 重置,不把殘留狀態帶給新玩家;
   * - 盤上有棋(對局中斷線)
   * → 保留,讓對手重連續戰。
   */
  if (
    opponentLeft ||
    !game ||
    !boardHasStones(game)
  ) {

    game =
      new GoGame(
        game ? game.size : 19
      );

    opponentLeft = false;
  }


  /*
   * 新玩家接手:確認身份後才關閉
   * 並清理舊的玩家連線
   * (觀戰者連入不會走到這裡)
   */
  if (peerConn && peerConn !== conn) {

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

  opponentLeft = false;

  reconnectAttempts = 0;

  setConnStatus(
    t('net.oppConnected'),
    'ok'
  );

  startHeartbeat();

  startGame(
    'p2p',
    game ? game.size : 19,
    BLACK
  );

  addLog(
    t('net.oppJoined'),
    'good'
  );

  if (game && conn.open) {

    try {

      conn.send(
        JSON.stringify({
          type: 'syncState',
          state:
            game.getFullState()
        })
      );

    } catch (e) {}
  }


  /*
   * 新玩家加入可能重置了棋局:
   * 把最新狀態也同步給所有觀戰者,
   * 觀戰畫面才不會停在上一局的殘局
   */
  relayToSpectators({
    type: 'syncState',
    state:
      game.getFullState()
  });
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


      /* 診斷:Console 過濾 [GO] 可追蹤訊息流 */
      if (m.type !== 'ping' && m.type !== 'pong') {
        console.info('[GO←]', m.type, isHost ? '(房主)' : '(客端)');
      }


      /*
       * 觀戰連線只能聊天/心跳/請求同步:
       * 任何會影響對局的訊息一律忽略,
       * 觀戰者無法以此影響棋局
       */
      if (
        spectatorConns.has(conn) &&
        m.type !== 'chatMessage' &&
        m.type !== 'ping' &&
        m.type !== 'pong' &&
        m.type !== 'requestSync' &&
        m.type !== 'hello'
      ) {
        return;
      }


      /*
       * 觀戰模式:只套用棋局同步類訊息,
       * 忽略玩家間協商(悔棋請求/拒絕)
       */
      if (
        mode === 'spectate' &&
        (
          m.type === 'undoRequest' ||
          m.type === 'undoReject'
        )
      ) {
        return;
      }


      /* Hello:表明身份(玩家/觀戰) */

      if (
        m.type === 'hello'
      ) {

        if (isHost) {

          if (
            m.role === 'spectate'
          ) {

            spectatorConns.add(
              conn
            );

            conn.__goSpectateName =
              m.name ||
              t('chat.spectator');

            try {

              window.GoChat?.hookConn?.(
                conn
              );

            } catch (e) {}


            if (
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

              } catch (e) {}
            }


            addLog(
              t('log.spectateJoined', {
                n: conn.__goSpectateName
              }),
              'system'
            );

          } else {

            hostAcceptPlayer(conn);
          }
        }

        return;
      }


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

        /*
         * 觀戰者離開:不影響對局狀態
         */
        if (
          spectatorConns.has(conn)
        ) {

          spectatorConns.delete(
            conn
          );

          addLog(
            t('log.spectateLeft', {
              n:
                conn.__goSpectateName ||
                t('chat.spectator')
            }),
            'system'
          );

          return;
        }


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

        if (isHost) {

          /*
           * 舊版客戶端不送 hello:
           * 收到 requestSync 視為玩家加入
           */
          if (
            !spectatorConns.has(conn)
          ) {

            hostAcceptPlayer(conn);
          }


          if (
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

        relayToSpectators(m);

        return;
      }


      /* Pass */

      if (
        m.type === 'pass'
      ) {

        applyPassRemote(
          m.result
        );

        relayToSpectators(m);

        return;
      }


      /* Dead stone marking(終局點目) */

      if (
        m.type === 'toggleDead'
      ) {

        if (
          game &&
          game.gameOver
        ) {

          game.toggleDead(
            m.x,
            m.y
          );

          updateUI();

          drawBoard();
        }

        relayToSpectators(m);

        return;
      }


      /* New Game */

      if (
        m.type === 'newGame'
      ) {

        doNewGame(true);

        relayToSpectators(m);

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

        relayToSpectators(m);

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

      console.info('[GO] 連線開啟', isHost ? '(房主端,等待 hello)' : '(客端)');

      /*
       * 玩家/觀戰端:主連線登記。
       * 房主端延後到 hello 才決定身份,
       * 避免觀戰連線暫佔玩家主連線。
       */
      if (!isHost) {

        peerConn = conn;

        peerConnections.add(
          conn
        );
      }


      opponentLeft = false;

      reconnectAttempts = 0;


      if (reconnectTimer) {

        clearTimeout(
          reconnectTimer
        );

        reconnectTimer = null;
      }


      if (!isHost) {

        setConnStatus(
          t('net.connected'),
          'ok'
        );


        startHeartbeat();


        /*
         * 表明身份:玩家 / 觀戰。
         * 舊版客戶端不送 hello,
         * 房主以 requestSync 回退為玩家。
         */
        try {

          conn.send(
            JSON.stringify({
              type: 'hello',
              role: joinRole,
              name:
                joinRole === 'spectate'
                  ? (
                      window.GoChat?.getName?.() ||
                      t('chat.spectator')
                    )
                  : undefined
            })
          );

        } catch (e) {}


        try {

          conn.send(
            JSON.stringify({
              type: 'requestSync'
            })
          );

        } catch (e) {}
      }
    }
  );


  /* -------------------------------------------------------
     Close
  ------------------------------------------------------- */

  conn.on(
    'close',
    () => {

      /*
       * 觀戰者斷線:清理名單即可,
       * 不觸發重連/對手中斷流程
       */
      if (
        spectatorConns.has(conn)
      ) {

        spectatorConns.delete(
          conn
        );

        addLog(
          t('log.spectateLeft', {
            n:
              conn.__goSpectateName ||
              t('chat.spectator')
          }),
          'system'
        );

        return;
      }


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
       * 身份待 hello 抵達後決定:
       * 玩家 → hostAcceptPlayer(此時才頂替舊玩家連線)
       * 觀戰 → 加入觀戰名單。
       * 舊連線的關閉不能在這裡做:
       * 觀戰者連入時不該踢掉對局中的玩家。
       */
      installConnHandlers(
        conn
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

  joinRole = 'play';

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

      /*
       * 握手期間使用者可能已返回大廳:
       * 放棄加入,銷毀連線
       */
      if (joinScreenAbandoned()) {

        try {
          peerInst.destroy();
        } catch (e) {}

        peerInst = null;

        return;
      }

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
       * 使用者已離開加入畫面:放棄進入
       */
      if (joinScreenAbandoned()) {

        try {
          conn.close();
        } catch (e) {}

        return;
      }


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
   Join Screen Abandoned
   (使用者已離開加入/觀戰畫面?未完成的
    連線流程不得再進入對局)
========================================================= */

function joinScreenAbandoned() {

  const js =
    $('p2pJoinScreen');

  return !js ||
    js.classList.contains(
      'hidden'
    );
}


/* =========================================================
   Spectate Room(觀戰:只同步,不可操作)
========================================================= */

async function peerSpectateRoom(
  code
) {

  isHost = false;

  joinRole = 'spectate';

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
    t('net.spectating', {
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

      /*
       * 握手期間使用者可能已返回大廳:
       * 放棄進入,銷毀連線
       */
      if (joinScreenAbandoned()) {

        try {
          peerInst.destroy();
        } catch (e) {}

        peerInst = null;

        return;
      }

      connectAsSpectator();
    }
  );


  peerInst.on(
    'disconnected',
    () => {

      if (manuallyLeaving)
        return;


      /*
       * 使用者已離開觀戰畫面:
       * 銷毀連線,不再重連
       */
      if (joinScreenAbandoned()) {

        try {
          peerInst.destroy();
        } catch (e) {}

        peerInst = null;

        return;
      }


      setConnStatus(
        t('net.recovering'),
        'pending'
      );


      try {

        peerInst.reconnect();

      } catch (e) {

        /*
         * 觀戰不自動重連,
         * 可手動重新加入房間
         */
      }
    }
  );
}


function connectAsSpectator() {

  const conn =
    peerInst.connect(
      'GO-' + p2pRoomCode,
      { reliable: true }
    );


  installConnHandlers(conn);


  conn.on(
    'open',
    () => {

      /*
       * 使用者已離開觀戰畫面:放棄進入
       */
      if (joinScreenAbandoned()) {

        try {
          conn.close();
        } catch (e) {}

        return;
      }

      mode = 'spectate';

      myColor = null;

      /*
       * 觀戰模式:隱藏操作區
       * (虛手/悔棋/新對局都與觀戰者無關)
       */
      document
        .querySelector(
          '.game-layout .actions'
        )
        ?.classList.add(
          'hidden'
        );

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
        t('game.modeSpectate');


      $('myRole').textContent =
        window.GoChat?.getName?.() ||
        t('chat.spectator');


      setConnStatus(
        t('net.joined'),
        'ok'
      );


      addLog(
        t('net.spectateSync'),
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
========================================================= */window.addEventListener(
  'go:langchange',
  () => {

    /*
     * 連線狀態徽章:由譯文反查回詞條者
     * 一律重繪,避免混雜新舊語言
     */
    if (
      connStatusRef &&
      connStatusRef.key
    ) {

      setConnStatus(
        t(connStatusRef.key),
        connStatusRef.cls
      );
    }

    if (
      p2pStatusRef &&
      p2pStatusRef.key
    ) {

      setP2PStatus(
        p2pStatusRef.which,
        t(p2pStatusRef.key),
        p2pStatusRef.cls
      );
    }


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
        : mode === 'spectate'
          ? t('game.modeSpectate')
          : t('game.modeP2p');


    $('myRole').textContent =
      mode === 'hotseat'
        ? t('dyn.roleShared')
        : mode === 'spectate'
          ? (
              window.GoChat?.getName?.() ||
              t('chat.spectator')
            )
          : (
              myColor === BLACK
                ? t('dyn.roleBlack')
                : t('dyn.roleWhite')
            );


    updateUI();
  }
);


/* =========================================================
   皮膚切換:即時重繪棋盤
========================================================= */

window.addEventListener(
  'go:skinchange',
  () => {

    if (game) {
      drawBoard();
    }
  }
);