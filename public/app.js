const EMPTY = 0, BLACK = 1, WHITE = 2;
const SAVE_KEY = 'go-p2p-save-v2';

const STARS = {
  9:  [[2,2],[2,6],[4,4],[6,2],[6,6]],
  13: [[3,3],[3,9],[6,6],[9,3],[9,9],[6,3],[6,9],[3,6],[9,6]],
  19: [[3,3],[3,9],[3,15],[9,3],[9,9],[9,15],[15,3],[15,9],[15,15]]
};

class GoGame {
  constructor(size = 19) {
    this.size = size;
    this.board = Array.from({length:size},()=>Array(size).fill(EMPTY));
    this.currentPlayer = BLACK;
    this.captures = { [BLACK]: 0, [WHITE]: 0 };
    this.history = [];
    this.koPoint = null;
    this.lastMove = null;
    this.passCount = 0;
    this.gameOver = false;
  }
  inBounds(x,y){return x>=0&&x<this.size&&y>=0&&y<this.size;}
  neighbors(x,y){
    const r=[];
    if(this.inBounds(x-1,y))r.push([x-1,y]);
    if(this.inBounds(x+1,y))r.push([x+1,y]);
    if(this.inBounds(x,y-1))r.push([x,y-1]);
    if(this.inBounds(x,y+1))r.push([x,y+1]);
    return r;
  }
  group(x,y){
    const c=this.board[x][y];if(c===EMPTY)return {stones:[],lib:new Set()};
    const vis=new Set(),stones=[],lib=new Set(),st=[[x,y]];
    while(st.length){
      const [cx,cy]=st.pop(),k=`${cx},${cy}`;
      if(vis.has(k))continue;vis.add(k);stones.push([cx,cy]);
      for(const[nx,ny]of this.neighbors(cx,cy)){
        const nk=`${nx},${ny}`;
        if(this.board[nx][ny]===EMPTY)lib.add(nk);
        else if(this.board[nx][ny]===c&&!vis.has(nk))st.push([nx,ny]);
      }
    }
    return {stones,lib};
  }
  remove(stones){for(const[x,y]of stones)this.board[x][y]=EMPTY;return stones.length;}
  hash(){return this.board.map(r=>r.join('')).join('|');}
  place(x,y){
    if(this.gameOver)return{ok:false,msg:'遊戲已結束'};
    if(!this.inBounds(x,y))return{ok:false,msg:'超出邊界'};
    if(this.board[x][y]!==EMPTY)return{ok:false,msg:'此位置已有棋子'};
    if(this.koPoint&&this.koPoint.x===x&&this.koPoint.y===y)return{ok:false,msg:'打劫禁止'};
    const opp=this.currentPlayer===BLACK?WHITE:BLACK;
    const prevHash=this.hash();
    this.board[x][y]=this.currentPlayer;
    const cap=[];
    for(const[nx,ny]of this.neighbors(x,y)){
      if(this.board[nx][ny]===opp){
        const g=this.group(nx,ny);
        if(g.lib.size===0){cap.push(...g.stones);this.remove(g.stones);}
      }
    }
    const mg=this.group(x,y);
    if(mg.lib.size===0){
      this.board[x][y]=EMPTY;
      for(const[cx,cy]of cap)this.board[cx][cy]=opp;
      return{ok:false,msg:'禁止自殺'};
    }
    if(cap.length===1&&this.history.length>0){
      const nh=this.hash();
      for(let i=this.history.length-1;i>=Math.max(0,this.history.length-3);i--){
        if(this.history[i].hash===nh){
          this.board[x][y]=EMPTY;
          for(const[cx,cy]of cap)this.board[cx][cy]=opp;
          return{ok:false,msg:'打劫禁止重複局面'};
        }
      }
    }
    const cc=cap.length;
    this.captures[this.currentPlayer]+=cc;
    this.koPoint=cc===1?{x:cap[0][0],y:cap[0][1]}:null;
    this.lastMove={x,y};this.passCount=0;
    this.history.push({hash:prevHash,move:{x,y,p:this.currentPlayer},captured:cap,koPoint:this.koPoint});
    const played=this.currentPlayer;
    this.currentPlayer=opp;
    return{ok:true,x,y,player:played,captured:cap,captures:{...this.captures},koPoint:this.koPoint,lastMove:this.lastMove,passCount:this.passCount};
  }
  pass(){
    if(this.gameOver)return{ok:false,msg:'遊戲已結束'};
    this.passCount++;
    this.history.push({hash:this.hash(),move:{pass:true,p:this.currentPlayer},captured:[],koPoint:null});
    this.koPoint=null;this.lastMove=null;
    const passing=this.currentPlayer;
    this.currentPlayer=this.currentPlayer===BLACK?WHITE:BLACK;
    if(this.passCount>=2)this.gameOver=true;
    return{ok:true,pass:true,passingPlayer:passing,nextPlayer:this.currentPlayer,gameOver:this.gameOver,captures:{...this.captures},passCount:this.passCount};
  }
  undo(){
    if(this.history.length===0)return{ok:false,msg:'無棋可悔'};
    const last=this.history.pop();
    if(!last.move.pass){
      const {x,y,p}=last.move;
      const opp=p===BLACK?WHITE:BLACK;
      for(const[cx,cy]of last.captured){
        this.board[cx][cy]=opp;
      }
      if(last.captured.length>0){
        this.captures[p]-=last.captured.length;
        if(this.captures[p]<0)this.captures[p]=0;
      }
      this.board[x][y]=EMPTY;
      this.currentPlayer=p;
      this.lastMove=this.history.length>0 && !this.history[this.history.length-1].move.pass
        ? {x:this.history[this.history.length-1].move.x, y:this.history[this.history.length-1].move.y}
        : null;
      this.passCount=0;
    }else{
      this.currentPlayer=last.move.p;
      if(this.passCount>0)this.passCount--;
      this.lastMove=null;
    }
    this.gameOver=false;
    this.koPoint=last.koPoint;
    return{ok:true,captures:{...this.captures},currentPlayer:this.currentPlayer,lastMove:this.lastMove,koPoint:this.koPoint};
  }
  reset(){
    this.board=Array.from({length:this.size},()=>Array(this.size).fill(EMPTY));
    this.currentPlayer=BLACK;this.captures={[BLACK]:0,[WHITE]:0};this.history=[];
    this.koPoint=null;this.lastMove=null;this.passCount=0;this.gameOver=false;
  }
  
  calculateChineseScore(komi = 7.5) {
    const size = this.size;
    const visited = Array.from({length: size}, () => Array(size).fill(false));
    let blackStones = 0, whiteStones = 0, blackTerritory = 0, whiteTerritory = 0, dame = 0;

    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        if (this.board[x][y] === BLACK) blackStones++;
        else if (this.board[x][y] === WHITE) whiteStones++;
      }
    }

    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        if (this.board[x][y] === EMPTY && !visited[x][y]) {
          const region = [];
          const queue = [[x, y]];
          visited[x][y] = true;
          let touchesBlack = false, touchesWhite = false;
          let head = 0;
          while(head < queue.length) {
            const [cx, cy] = queue[head++];
            region.push([cx, cy]);
            for (const [nx, ny] of this.neighbors(cx, cy)) {
              const c = this.board[nx][ny];
              if (c === BLACK) touchesBlack = true;
              else if (c === WHITE) touchesWhite = true;
              else if (c === EMPTY && !visited[nx][ny]) {
                visited[nx][ny] = true;
                queue.push([nx, ny]);
              }
            }
          }
          if (touchesBlack && !touchesWhite) blackTerritory += region.length;
          else if (touchesWhite && !touchesBlack) whiteTerritory += region.length;
          else dame += region.length;
        }
      }
    }

    const blackTotal = blackStones + blackTerritory;
    const whiteTotal = whiteStones + whiteTerritory + komi;
    const winner = blackTotal > whiteTotal ? BLACK : WHITE;
    const diff = Math.abs(blackTotal - whiteTotal);
    return { blackStones, whiteStones, blackTerritory, whiteTerritory, blackTotal, whiteTotal, komi, winner, diff };
  }

  getFullState(){
    return{
      size:this.size,
      board:this.board.map(r=>[...r]),
      currentPlayer:this.currentPlayer,
      captures:{...this.captures},
      history:this.history.map(h=>({...h,captured:[...h.captured]})),
      koPoint:this.koPoint?{...this.koPoint}:null,
      lastMove:this.lastMove?{...this.lastMove}:null,
      passCount:this.passCount,
      gameOver:this.gameOver
    };
  }
  loadFullState(s){
    this.size=s.size;
    this.board=s.board.map(r=>[...r]);
    this.currentPlayer=s.currentPlayer;
    this.captures={...s.captures};
    this.history=s.history.map(h=>({...h,captured:[...(h.captured||[])]}));
    this.koPoint=s.koPoint?{...s.koPoint}:null;
    this.lastMove=s.lastMove?{...s.lastMove}:null;
    this.passCount=s.passCount||0;
    this.gameOver=!!s.gameOver;
  }
}

const lobby = document.getElementById('lobby');
const gameScreen = document.getElementById('gameScreen');
const boardCanvas = document.getElementById('boardCanvas');
const ctx = boardCanvas ? boardCanvas.getContext('2d') : null;

let game = null;
let mode = null;
let myColor = BLACK;
let cellSize = 30;
let margin = 30;
let hoverPos = null;
let transport = null;
let pendingUndo = false;
let undoRequestFrom = null;
let roomCodeShared = null;
let peerConnections = new Set();
let isHost = false;

function $(id){return document.getElementById(id);}

function saveGameToStorage(){
  if(!game||!mode)return;
  try{
    const payload={
      mode,myColor,isHost,
      roomCode:p2pRoomCode||null,
      state:game.getFullState(),
      savedAt:Date.now()
    };
    localStorage.setItem(SAVE_KEY,JSON.stringify(payload));
  }catch(e){}
}
function loadGameFromStorage(){
  try{
    const raw=localStorage.getItem(SAVE_KEY);
    if(!raw)return null;
    return JSON.parse(raw);
  }catch(e){return null;}
}
function clearSavedGame(){
  try{localStorage.removeItem(SAVE_KEY);}catch(e){}
}
function showResumeCardIfAvailable(){
  const data=loadGameFromStorage();
  const card=$('resumeCard');
  const info=$('resumeInfo');
  if(!data||!data.state){card?.classList.add('hidden');return;}
  const s=data.state;
  const moves=s.history.length;
  const ageMin=Math.round((Date.now()-data.savedAt)/60000);
  const modeTxt={hotseat:'單機雙人',local:'分頁連線',p2p:'P2P 線上'}[data.mode]||data.mode;
  const roomTxt=data.roomCode?`，邀請碼 <b>${data.roomCode}</b>`:'';
  info.innerHTML=`<b>${modeTxt}</b> · ${s.size}×${s.size}${roomTxt}<br>已下 <b>${moves}</b> 手 · 儲存於 ${ageMin<1?'剛剛':ageMin+' 分鐘前'}`;
  card?.classList.remove('hidden');
}

$('resumeBtn')?.addEventListener('click',()=>{
  const data=loadGameFromStorage();
  if(!data||!data.state)return;
  game=new GoGame(data.state.size);
  game.loadFullState(data.state);
  mode=data.mode;
  myColor=data.myColor;
  p2pRoomCode=data.roomCode||null;
  roomCodeShared=data.roomCode||null;
  isHost = data.isHost !== undefined ? data.isHost : (myColor === BLACK);

  if(mode==='hotseat'||mode==='local'){
    resumeGame(mode,myColor);
    if(mode==='local'){
      const ch=new BroadcastChannel('go-local-match-v3');
      const myNonce=Math.random().toString(36).slice(2);
      transport={
        send(msg){try{ch.postMessage({...msg,_from:myNonce});}catch(e){}},
        close(){try{ch.close();}catch(e){}}
      };
      ch.onmessage=(e)=>{
        const m=e.data;if(!m||m._from===myNonce)return;
        if(m.type==='hello'){transport.send({type:'helloAck',size:game.size});setConnStatus('對手已就緒','ok');}
        else if(m.type==='helloAck'){setConnStatus('連線成功','ok');}
        else if(m.type==='move')applyMoveRemote(m.result);
        else if(m.type==='pass')applyPassRemote(m.result);
        else if(m.type==='newGame')doNewGame(true);
        else if(m.type==='undoRequest')onUndoRequest(m.player);
        else if(m.type==='undoAccept')onUndoAccept(m);
        else if(m.type==='undoReject')onUndoReject();
      };
      transport.send({type:'hello'});
    }
  }else if(mode==='p2p'){
    resumeGame('p2p',myColor);
    if(isHost && data.roomCode){
      peerHostRoom(data.state.size,data.roomCode,true);
    }else{
      setP2PStatus('join','🔄 請聯繫房主重新建立房間後以邀請碼加入','warn');
    }
  }
});
$('clearResumeBtn')?.addEventListener('click',()=>{
  clearSavedGame();$('resumeCard')?.classList.add('hidden');
});

document.querySelectorAll('input[name="boardSize"]').forEach(r=>{
  r.addEventListener('change',()=>{
    document.querySelectorAll('.size-row label').forEach(l=>l.classList.remove('checked'));
    r.parentElement.classList.add('checked');
  });
});

function addLog(text, cls=''){
  const log=$('messageLog');
  if(!log)return;
  const el=document.createElement('div');
  el.className='log-entry '+(cls||'');
  const t=new Date().toLocaleTimeString('zh-TW',{hour12:false});
  el.textContent=`[${t}] ${text}`;
  log.appendChild(el);log.scrollTop=log.scrollHeight;
}
function setConnStatus(text, cls='ok'){const s=$('connStatus');if(s){s.textContent=text;s.className='badge '+cls;}}
function setPlayerStatus(color, text){const el=$(color===BLACK?'blackStatus':'whiteStatus');if(el)el.textContent=text;}
function setP2PStatus(which, text, cls=''){const el=$(which==='host'?'p2pHostStatus':'p2pJoinStatus');if(el){el.textContent=text;el.className='status '+(cls||'');}}
function canPlay(){if(!game||game.gameOver)return false;if(mode==='hotseat')return true;return game.currentPlayer===myColor;}

function setupCanvas(){
  if(!game||!boardCanvas||!ctx)return;
  const dpr=window.devicePixelRatio||1;
  const rect=boardCanvas.getBoundingClientRect();
  if(rect.width===0)return;
  boardCanvas.width=rect.width*dpr;boardCanvas.height=rect.height*dpr;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  margin=rect.width*0.055;
  cellSize=(rect.width-margin*2)/(game.size-1);
}

function drawBoard(){
  if(!game||!boardCanvas||!ctx)return;
  const displayW=boardCanvas.getBoundingClientRect().width;
  if(displayW===0){setTimeout(drawBoard,50);return;}
  const size=game.size;
  ctx.clearRect(0,0,displayW,displayW);
  const g=ctx.createLinearGradient(0,0,displayW,displayW);
  g.addColorStop(0,'#e6c38a');g.addColorStop(1,'#d4a85f');
  ctx.fillStyle=g;roundRect(ctx,0,0,displayW,displayW,12);ctx.fill();
  ctx.strokeStyle='#3a2a15';ctx.lineWidth=1;
  for(let i=0;i<size;i++){
    const p=margin+i*cellSize;
    ctx.beginPath();ctx.moveTo(margin,p);ctx.lineTo(margin+(size-1)*cellSize,p);
    ctx.moveTo(p,margin);ctx.lineTo(p,margin+(size-1)*cellSize);ctx.stroke();
  }
  const stars=STARS[size]||[];
  ctx.fillStyle='#3a2a15';
  for(const[sx,sy]of stars){
    const cx=margin+sx*cellSize,cy=margin+sy*cellSize;
    ctx.beginPath();ctx.arc(cx,cy,cellSize*0.1,0,Math.PI*2);ctx.fill();
  }
  const labels='ABCDEFGHJKLMNOPQRST';
  ctx.fillStyle='#5a4025';ctx.font=`${Math.max(10,cellSize*0.35)}px sans-serif`;
  ctx.textAlign='center';ctx.textBaseline='middle';
  for(let i=0;i<size;i++){
    const p=margin+i*cellSize;
    ctx.fillText(labels[i],p,margin*0.42);ctx.fillText(labels[i],p,displayW-margin*0.42);
    ctx.fillText(String(size-i),margin*0.42,p);ctx.fillText(String(size-i),displayW-margin*0.42,p);
  }
  for(let x=0;x<size;x++)for(let y=0;y<size;y++){
    if(game.board[x][y]!==EMPTY)drawStone(x,y,game.board[x][y]);
  }
  if(game.lastMove){
    const {x,y}=game.lastMove;
    const cx=margin+x*cellSize,cy=margin+y*cellSize;
    ctx.strokeStyle=game.board[x][y]===BLACK?'#ff4757':'#e74c3c';
    ctx.lineWidth=2;ctx.beginPath();ctx.arc(cx,cy,cellSize*0.22,0,Math.PI*2);ctx.stroke();
  }
  if(game.koPoint){
    const {x,y}=game.koPoint;
    const cx=margin+x*cellSize,cy=margin+y*cellSize;
    ctx.fillStyle='rgba(231,76,60,0.35)';ctx.beginPath();ctx.arc(cx,cy,cellSize*0.3,0,Math.PI*2);ctx.fill();
  }
  if(hoverPos&&canPlay()){
    const {x,y}=hoverPos;
    if(game.board[x][y]===EMPTY&&!(game.koPoint&&game.koPoint.x===x&&game.koPoint.y===y)){
      const cx=margin+x*cellSize,cy=margin+y*cellSize;
      const c=(mode==='hotseat'?game.currentPlayer:myColor);
      ctx.fillStyle=c===BLACK?'rgba(0,0,0,0.35)':'rgba(255,255,255,0.5)';
      ctx.beginPath();ctx.arc(cx,cy,cellSize*0.42,0,Math.PI*2);ctx.fill();
    }
  }
}

function drawStone(x,y,c){
  const cx=margin+x*cellSize,cy=margin+y*cellSize,r=cellSize*0.46;
  ctx.save();
  ctx.shadowColor='rgba(0,0,0,0.35)';ctx.shadowBlur=cellSize*0.15;ctx.shadowOffsetX=1;ctx.shadowOffsetY=2;
  const rg=ctx.createRadialGradient(cx-r*0.35,cy-r*0.35,r*0.1,cx,cy,r);
  if(c===BLACK){rg.addColorStop(0,'#666');rg.addColorStop(0.5,'#222');rg.addColorStop(1,'#000');}
  else{rg.addColorStop(0,'#fff');rg.addColorStop(0.7,'#e8e8e8');rg.addColorStop(1,'#bdbdbd');}
  ctx.fillStyle=rg;ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fill();
  ctx.restore();
}

function roundRect(ctx,x,y,w,h,r){
  ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);
  ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);
  ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);
  ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);
  ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();
}

function pixToPos(px,py){
  if(!game)return null;
  const rect=boardCanvas.getBoundingClientRect();
  const x=(px-rect.left-margin)/cellSize, y=(py-rect.top-margin)/cellSize;
  const rx=Math.round(x), ry=Math.round(y);
  if(rx<0||rx>=game.size||ry<0||ry>=game.size)return null;
  const cx=margin+rx*cellSize, cy=margin+ry*cellSize;
  if(Math.sqrt((px-rect.left-cx)**2 + (py-rect.top-cy)**2)>cellSize*0.5)return null;
  return{x:rx,y:ry};
}

if(boardCanvas){
  boardCanvas.addEventListener('click',e=>{
    const pos=pixToPos(e.clientX,e.clientY);
    if(canPlay()&&pos)doMove(pos.x,pos.y);
  });
  boardCanvas.addEventListener('mousemove',e=>{
    const pos=pixToPos(e.clientX,e.clientY);
    if(JSON.stringify(pos)!==JSON.stringify(hoverPos)){hoverPos=pos;drawBoard();}
  });
  boardCanvas.addEventListener('mouseleave',()=>{if(hoverPos){hoverPos=null;drawBoard();}});
}
window.addEventListener('resize',()=>{if(game){setupCanvas();drawBoard();}});

let modalCallback=null;
function showModal(title, body, callback){
  $('modalTitle').textContent=title;$('modalBody').innerHTML=body;
  modalCallback=callback;$('modalOverlay')?.classList.remove('hidden');
}
function closeModal(){$('modalOverlay')?.classList.add('hidden');modalCallback=null;}
$('modalCancel')?.addEventListener('click',()=>{const cb=modalCallback;closeModal();if(cb)cb(false);});
$('modalOk')?.addEventListener('click',()=>{const cb=modalCallback;closeModal();if(cb)cb(true);});

$('passBtn')?.addEventListener('click',()=>{if(canPlay())doPass();});
$('undoBtn')?.addEventListener('click',requestUndo);
$('newGameBtn')?.addEventListener('click',()=>showModal('確認新對局','確定要開始新對局嗎？',ok=>{if(ok)doNewGame(false);}));
$('leaveBtn')?.addEventListener('click',leaveGame);

$('copyRoomBtn')?.addEventListener('click',()=>{copy($('p2pRoomCode')?.value);addLog('邀請碼已複製','system');});
$('shareRoomBtn')?.addEventListener('click',()=>{
  const v=$('p2pRoomCode')?.value;if(!v)return;
  const url=location.origin+location.pathname+'?room='+v;
  copy(url);alert('邀請連結已複製：\n'+url);
});
function copy(v){if(v)navigator.clipboard?.writeText(v).catch(()=>{});}

function showLobbyHome(){
  $('lobbyHome')?.classList.remove('hidden');
  $('p2pHostScreen')?.classList.add('hidden');
  $('p2pJoinScreen')?.classList.add('hidden');
  showResumeCardIfAvailable();
}
function showHostScreen(){$('lobbyHome')?.classList.add('hidden');$('p2pHostScreen')?.classList.remove('hidden');$('p2pJoinScreen')?.classList.add('hidden');}
function showJoinScreen(){$('lobbyHome')?.classList.add('hidden');$('p2pHostScreen')?.classList.add('hidden');$('p2pJoinScreen')?.classList.remove('hidden');}

document.querySelectorAll('[data-action]').forEach(el=>{
  el.addEventListener('click',()=>handleAction(el.dataset.action));
});
$('backFromHost')?.addEventListener('click',showLobbyHome);
$('backFromJoin')?.addEventListener('click',showLobbyHome);

$('submitRoomBtn')?.addEventListener('click',()=>{
  const v=($('p2pRoomInput')?.value||'').trim().toUpperCase();
  if(v.length>=4)peerJoinRoom(v);
});

function handleAction(act){
  let size=19;
  document.querySelectorAll('input[name="boardSize"]').forEach(r=>{if(r.checked)size=parseInt(r.value);});
  if(act==='hotseat')startGame('hotseat',size,BLACK);
  else if(act==='local-start')startLocal(true,size);
  else if(act==='local-join')startLocal(false,size);
  else if(act==='p2p-host'){showHostScreen();peerHostRoom(size);}
  else if(act==='goto-join'){showJoinScreen();$('p2pRoomInput').value='';}
}

function startGame(m, size, color){
  mode=m;myColor=color;game=new GoGame(size);
  lobby?.classList.add('hidden');gameScreen?.classList.remove('hidden');
  $('connMode').textContent=m==='hotseat'?'單機雙人':(m==='local'?'分頁連線':'P2P 線上');
  $('myRole').textContent=m==='hotseat'?'雙人共用':(color===BLACK?'黑棋':'白棋');
  $('messageLog').innerHTML='';
  pendingUndo=false;undoRequestFrom=null;
  addLog('對局開始！','system');
  updateUI();saveGameToStorage();
  setTimeout(()=>{setupCanvas();drawBoard();},100);
}

function resumeGame(m, color){
  mode=m;myColor=color;
  lobby?.classList.add('hidden');gameScreen?.classList.remove('hidden');
  $('connMode').textContent=m==='hotseat'?'單機雙人':(m==='local'?'分頁連線':'P2P 線上');
  $('myRole').textContent=m==='hotseat'?'雙人共用':(color===BLACK?'黑棋':'白棋');
  pendingUndo=false;
  updateUI();saveGameToStorage();
  setTimeout(()=>{setupCanvas();drawBoard();},100);
}

function applyMoveRemote(r){
  if(!r.ok||!game)return;
  const prevHash=game.hash();
  if(r.captured&&r.captured.length)for(const[cx,cy]of r.captured)game.board[cx][cy]=EMPTY;
  game.board[r.x][r.y]=r.player;
  game.currentPlayer=r.player===BLACK?WHITE:BLACK;
  game.captures=r.captures;game.lastMove=r.lastMove;game.koPoint=r.koPoint;
  game.passCount=r.passCount||0;
  game.history.push({hash:prevHash,move:{x:r.x,y:r.y,p:r.player},captured:r.captured||[],koPoint:r.koPoint?{...r.koPoint}:null});
  updateUI();drawBoard();saveGameToStorage();
}

function applyPassRemote(r){
  if(!game)return;
  game.captures=r.captures;
  game.history.push({hash:game.hash(),move:{pass:true,p:r.passingPlayer},captured:[],koPoint:null});
  game.currentPlayer=r.nextPlayer;
  game.lastMove=null;game.koPoint=null;game.passCount=r.passCount||1;
  if(r.gameOver)game.gameOver=true;
  updateUI();drawBoard();saveGameToStorage();
}

function doMove(x,y){
  if(!game)return;
  const r=game.place(x,y);
  if(!r.ok){addLog(r.msg,'error');return;}
  sendMessage({type:'move',result:r});
  updateUI();drawBoard();saveGameToStorage();
}
function doPass(){
  if(!game)return;
  const r=game.pass();
  if(!r.ok)return;
  sendMessage({type:'pass',result:r});
  updateUI();drawBoard();saveGameToStorage();
}
function doNewGame(fromRemote=false){
  if(!game)return;
  game.reset();pendingUndo=false;
  if(!fromRemote)sendMessage({type:'newGame'});
  updateUI();drawBoard();saveGameToStorage();
}

function sendMessage(msg){
  if(transport){try{transport.send(msg);return true;}catch(e){}}
  if(peerConn&&peerConn.open){try{peerConn.send(JSON.stringify(msg));return true;}catch(e){}}
  for(const c of peerConnections){try{if(c&&c.open){c.send(JSON.stringify(msg));return true;}}catch(e){}}
  return false;
}

function requestUndo(){
  if(!game||game.history.length===0){addLog('無棋可悔','error');return;}
  if(mode==='hotseat'){
    game.undo();updateUI();drawBoard();saveGameToStorage();return;
  }
  if(pendingUndo){addLog('已有等待中的悔棋請求','warn');return;}
  const last=game.history[game.history.length-1];
  if(last.move.p!==myColor){addLog('只能悔自己走的棋','error');return;}
  sendMessage({type:'undoRequest',player:myColor});
  pendingUndo=true;
  addLog('已送出悔棋請求，等待對方同意...','system');
}

function onUndoRequest(fromColor){
  if(!game||game.history.length===0)return;
  showModal('悔棋請求','對手請求悔棋，是否同意？',agree=>{
    if(agree){
      const r=game.undo();
      if(r.ok){
        updateUI();drawBoard();
        const state=game.getFullState();
        sendMessage({type:'undoAccept',player:myColor,state:state});
        addLog('已同意悔棋，棋盤狀態已同步，輪到你落子','good');
        saveGameToStorage();
      }
    }else{
      sendMessage({type:'undoReject',player:myColor});
    }
  });
}

function onUndoAccept(msg){
  pendingUndo=false;
  if(msg&&msg.state){
    game.loadFullState(msg.state);
    updateUI();drawBoard();saveGameToStorage();
    addLog('對方已同意悔棋！棋盤已同步，目前輪到你落子','good');
  }
}
function onUndoReject(){
  pendingUndo=false;
  addLog('對方已拒絕悔棋','error');
}

function updateUI(){
  if(!game)return;
  $('blackCaptures').textContent=game.captures[BLACK];
  $('whiteCaptures').textContent=game.captures[WHITE];
  $('blackCard')?.classList.toggle('active',!game.gameOver&&game.currentPlayer===BLACK);
  $('whiteCard')?.classList.toggle('active',!game.gameOver&&game.currentPlayer===WHITE);
  const ind=$('turnIndicator'), txt=$('turnText');
  if(ind){
    if(game.gameOver){
      const score=game.calculateChineseScore(7.5);
      txt.innerHTML=`對局結束！${score.winner===BLACK?'黑':'白'}勝 ${score.diff.toFixed(1)} 目`;
    }else{
      const name=game.currentPlayer===BLACK?'黑':'白';
      txt.textContent=name+'棋' + (mode!=='hotseat'?(myColor===game.currentPlayer?'（輪到你）':'（等待對手）'):'');
    }
  }
  $('passBtn').disabled=!canPlay();
  $('undoBtn').disabled=!(game&&game.history.length>0)||pendingUndo;
}

function leaveGame(){
  if(transport)try{transport.close();}catch(e){}
  if(peerInst)try{peerInst.destroy();}catch(e){}
  peerConnections.clear();peerConn=null;transport=null;game=null;mode=null;
  clearSavedGame();
  gameScreen?.classList.add('hidden');lobby?.classList.remove('hidden');
  showLobbyHome();
}

function startLocal(isHostReq, size){
  const color=isHostReq?BLACK:WHITE;
  const ch=new BroadcastChannel('go-local-match-v3');
  const myNonce=Math.random().toString(36).slice(2);
  transport={
    send(msg){try{ch.postMessage({...msg,_from:myNonce});}catch(e){}},
    close(){try{ch.close();}catch(e){}}
  };
  ch.onmessage=(e)=>{
    const m=e.data;if(!m||m._from===myNonce)return;
    if(m.type==='hello')transport.send({type:'helloAck'});
    else if(m.type==='move')applyMoveRemote(m.result);
    else if(m.type==='pass')applyPassRemote(m.result);
    else if(m.type==='newGame')doNewGame(true);
    else if(m.type==='undoRequest')onUndoRequest(m.player);
    else if(m.type==='undoAccept')onUndoAccept(m);
    else if(m.type==='undoReject')onUndoReject();
  };
  startGame('local',size,color);
  transport.send({type:'hello'});
}

let peerInst=null, peerConn=null, p2pRoomCode=null, peerLoaded=(typeof Peer!=='undefined');

function loadPeerJS(){
  if(peerLoaded)return Promise.resolve(true);
  return new Promise(res=>{
    const s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
    s.onload=()=>{peerLoaded=true;res(true);};
    s.onerror=()=>res(false);
    document.head.appendChild(s);
  });
}
function genCode(){
  const s='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c='';for(let i=0;i<6;i++)c+=s[Math.floor(Math.random()*s.length)];
  return c;
}

function attachPeerHandlers(size, role){
  peerInst.on('open',id=>{
    if(role==='host'){
      $('p2pRoomCode').value=p2pRoomCode;
      setP2PStatus('host','就緒！邀請碼 '+p2pRoomCode+'，等待對手加入...','ok');
    }
  });
  peerInst.on('connection',conn=>{
    conn.on('open',()=>{
      conn.on('data',raw=>{
        const m=typeof raw==='string'?JSON.parse(raw):raw;
        if(!m)return;
        if(m.type==='hello'){
          if(game){
            const assigned=(myColor===BLACK)?WHITE:BLACK;
            conn.send(JSON.stringify({type:'takeOver',color:assigned,state:game.getFullState()}));
          }else{
            peerConn=conn;peerConnections.add(conn);
            peerDataReady(conn, BLACK, size);
          }
        }else if(m.type==='takeOverAck'){
          peerConn=conn;peerConnections.add(conn);
          installConnHandlers(conn);
          setConnStatus('對手已成功接手','ok');
        }
      });
      conn.send(JSON.stringify({type:'helloAck',hasGame:!!game,myColor:myColor}));
    });
  });
}

function installConnHandlers(conn){
  conn.on('data',raw=>{
    const m=typeof raw==='string'?JSON.parse(raw):raw;
    if(!m)return;
    if(m.type==='move')applyMoveRemote(m.result);
    else if(m.type==='pass')applyPassRemote(m.result);
    else if(m.type==='newGame')doNewGame(true);
    else if(m.type==='undoRequest')onUndoRequest(m.player);
    else if(m.type==='undoAccept')onUndoAccept(m);
    else if(m.type==='undoReject')onUndoReject();
  });
}

async function peerHostRoom(size, fixedCode=null, isRetry=false){
  isHost=true;
  const code=fixedCode||genCode();
  if(peerInst){try{peerInst.destroy();}catch(e){}}
  if(!peerLoaded&&!(await loadPeerJS()))return;
  p2pRoomCode=code;
  // 關鍵：明確宣告 secure: true 與 port: 443 以確保 GitHub Pages (HTTPS) 正常連線
  peerInst=new Peer('GO-'+code,{
    debug:1,
    secure:true,
    port:443,
    config:{iceServers:[{urls:'stun:stun.l.google.com:19302'}]}
  });
  attachPeerHandlers(size,'host');
}

async function peerJoinRoom(code){
  isHost=false;
  code=code.toUpperCase().trim();
  p2pRoomCode=code;
  setP2PStatus('join','正在連接房間 '+code+' ...','pending');
  if(peerInst){try{peerInst.destroy();}catch(e){}}
  if(!peerLoaded&&!(await loadPeerJS()))return;

  peerInst=new Peer({
    debug:1,
    secure:true,
    port:443,
    config:{iceServers:[{urls:'stun:stun.l.google.com:19302'}]}
  });
  peerInst.on('open',()=>{
    const c=peerInst.connect('GO-'+code,{reliable:true});
    c.on('open',()=>{
      peerConn=c;peerConnections.add(c);
      c.send(JSON.stringify({type:'hello'}));
      c.on('data',raw=>{
        const m=typeof raw==='string'?JSON.parse(raw):raw;
        if(!m)return;
        if(m.type==='helloAck'&&!m.hasGame){
          peerDataReady(c, WHITE, 19);
        }else if(m.type==='takeOver'){
          game=new GoGame(m.state.size);
          game.loadFullState(m.state);
          resumeGame('p2p', m.color);
          installConnHandlers(c);
          c.send(JSON.stringify({type:'takeOverAck'}));
          setConnStatus('接手連線成功','ok');
        }
      });
    });
  });
}

function peerDataReady(conn, color, size){
  transport={
    send(msg){try{conn.send(JSON.stringify(msg));}catch(e){}},
    close(){try{conn.close();}catch(e){}}
  };
  installConnHandlers(conn);
  if(!game)startGame('p2p',size,color);
  setConnStatus('P2P 連線成功','ok');
  addLog('P2P 點對點連線建立成功！','good');
  saveGameToStorage();
}

(function autoJoin(){
  try{
    const r=new URLSearchParams(location.search).get('room');
    if(r&&r.length>=4){
      setTimeout(()=>{
        showJoinScreen();
        $('p2pRoomInput').value=r.toUpperCase();
        peerJoinRoom(r);
      },300);
    }
  }catch(e){}
})();
