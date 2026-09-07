const EMPTY = 0, BLACK = 1, WHITE = 2;
const SAVE_KEY = 'go-p2p-save-v1';

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

window.addEventListener('error',e=>{
  try{console.error('[GLOBAL ERROR]',e);}catch(_){}
  try{
    const log=document.getElementById('messageLog');
    if(log){
      const d=document.createElement('div');
      d.className='log-entry error';
      d.textContent='[錯誤] '+(e&&e.message?e.message:String(e.error||e));
      log.appendChild(d);log.scrollTop=log.scrollHeight;
    }
  }catch(_){}
});

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

function $(id){return document.getElementById(id);}
function b64encode(str){return btoa(unescape(encodeURIComponent(str)));}
function b64decode(str){try{return decodeURIComponent(escape(atob(str)));}catch(e){return null;}}

/* ---------- 存檔/讀檔 ---------- */
function saveGameToStorage(){
  if(!game||!mode)return;
  try{
    const payload={
      mode,myColor,
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
  if(mode==='hotseat'||mode==='local'){
    resumeGame(mode,myColor);
    if(mode==='local'){
      const ch=new BroadcastChannel('go-local-match-v2');
      const myNonce=Math.random().toString(36).slice(2);
      transport={
        send(msg){try{ch.postMessage({...msg,_from:myNonce});}catch(e){}},
        close(){try{ch.close();}catch(e){}}
      };
      let otherReady=false;
      ch.onmessage=(e)=>{
        const m=e.data;if(!m||m._from===myNonce)return;
        if(m.type==='hello'){otherReady=true;setConnStatus('對手已就緒','ok');setPlayerStatus(WHITE,'已就緒');addLog('✅ 對手已就緒','good');transport.send({type:'helloAck',size:game.size});}
        else if(m.type==='helloAck'){otherReady=true;setConnStatus('連線成功','ok');setPlayerStatus(BLACK,'已就緒');addLog('✅ 連線成功！','good');}
        else if(m.type==='move')applyMoveRemote(m.result);
        else if(m.type==='pass')applyPassRemote(m.result);
        else if(m.type==='newGame')doNewGame(true);
        else if(m.type==='undoRequest')onUndoRequest(m.player);
        else if(m.type==='undoAccept')onUndoAccept(m);
        else if(m.type==='undoReject')onUndoReject();
      };
      setConnStatus(myColor===BLACK?'等待對手開啟另一分頁...':'嘗試連線房主...','warn');
      setPlayerStatus(myColor===BLACK?WHITE:BLACK,'等待連線');
      transport.send({type:'hello'});
    }
  }else if(mode==='p2p'){
    resumeGame('p2p',myColor);
    if(myColor===BLACK&&data.roomCode){
      setConnStatus('🔄 重新建立房主連線（邀請碼 '+data.roomCode+'），等待對手重新加入...','warn');
      setPlayerStatus(WHITE,'等待接手');
      addLog('正在重新開放房間 '+data.roomCode+'，對手可用邀請碼重新接手繼續對局','system');
      peerHostRoom(data.state.size,data.roomCode,true);
    }else{
      setConnStatus('等待房主重新建立房間並邀請加入...','warn');
      setP2PStatus('join','🔄 請聯繫房主重新建立房間後以邀請碼加入','warn');
      addLog('你是 '+ (myColor===BLACK?'黑':'白') +' 棋，因你非房主，請聯繫房主重新建立房間後再加入以繼續對局','warn');
    }
  }
});
$('clearResumeBtn')?.addEventListener('click',()=>{
  clearSavedGame();$('resumeCard')?.classList.add('hidden');
});

/* ---------- 棋盤大小 radio 切換 ---------- */
document.querySelectorAll('input[name="boardSize"]').forEach(r=>{
  r.addEventListener('change',()=>{
    document.querySelectorAll('.size-row label').forEach(l=>l.classList.remove('checked'));
    r.parentElement.classList.add('checked');
  });
});

function addLog(text, cls=''){
  const log=$('messageLog');
  if(!log){try{console.log('[LOG]',text);}catch(e){}return;}
  const el=document.createElement('div');
  el.className='log-entry '+(cls||'');
  const t=new Date().toLocaleTimeString('zh-TW',{hour12:false});
  el.textContent=`[${t}] ${text}`;
  log.appendChild(el);log.scrollTop=log.scrollHeight;
}

function setConnStatus(text, cls='ok'){
  const s=$('connStatus');
  if(s){s.textContent=text;s.className='badge '+cls;}
}

function setPlayerStatus(color, text){
  const id=color===BLACK?'blackStatus':'whiteStatus';
  const el=$(id);
  if(el)el.textContent=text;
}

function setP2PStatus(which, text, cls=''){
  const id=which==='host'?'p2pHostStatus':'p2pJoinStatus';
  const el=$(id);
  if(!el)return;
  el.textContent=text;
  el.className='status '+(cls||'');
}

function canPlay(debug=false){
  if(!game){if(debug)addLog('[canPlay] game 尚未初始化','warn');return false;}
  if(game.gameOver){if(debug)addLog('[canPlay] 遊戲已結束','warn');return false;}
  if(mode==='hotseat')return true;
  const ok=game.currentPlayer===myColor;
  if(debug&&!ok)addLog('[canPlay] 非本輪：目前 '+game.currentPlayer+' 你是 '+myColor,'warn');
  return ok;
}

function setupCanvas(){
  if(!game||!boardCanvas||!ctx)return;
  const dpr=window.devicePixelRatio||1;
  const rect=boardCanvas.getBoundingClientRect();
  if(rect.width===0)return;
  boardCanvas.width=rect.width*dpr;
  boardCanvas.height=rect.height*dpr;
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
  ctx.fillStyle=g;
  roundRect(ctx,0,0,displayW,displayW,12);ctx.fill();
  ctx.strokeStyle='#3a2a15';ctx.lineWidth=1;
  for(let i=0;i<size;i++){
    const p=margin+i*cellSize;
    ctx.beginPath();
    ctx.moveTo(margin,p);ctx.lineTo(margin+(size-1)*cellSize,p);
    ctx.moveTo(p,margin);ctx.lineTo(p,margin+(size-1)*cellSize);
    ctx.stroke();
  }
  const stars=STARS[size]||[];
  ctx.fillStyle='#3a2a15';
  for(const[sx,sy]of stars){
    const cx=margin+sx*cellSize,cy=margin+sy*cellSize;
    ctx.beginPath();ctx.arc(cx,cy,cellSize*0.1,0,Math.PI*2);ctx.fill();
  }
  const labels='ABCDEFGHJKLMNOPQRST';
  ctx.fillStyle='#5a4025';
  ctx.font=`${Math.max(10,cellSize*0.35)}px sans-serif`;
  ctx.textAlign='center';ctx.textBaseline='middle';
  for(let i=0;i<size;i++){
    const p=margin+i*cellSize;
    ctx.fillText(labels[i],p,margin*0.42);
    ctx.fillText(labels[i],p,displayW-margin*0.42);
    ctx.fillText(String(size-i),margin*0.42,p);
    ctx.fillText(String(size-i),displayW-margin*0.42,p);
  }
  for(let x=0;x<size;x++)for(let y=0;y<size;y++){
    if(game.board[x][y]!==EMPTY)drawStone(x,y,game.board[x][y]);
  }
  if(game.lastMove){
    const {x,y}=game.lastMove;
    const cx=margin+x*cellSize,cy=margin+y*cellSize;
    ctx.strokeStyle=game.board[x][y]===BLACK?'#ff4757':'#e74c3c';
    ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(cx,cy,cellSize*0.22,0,Math.PI*2);ctx.stroke();
  }
  if(game.koPoint){
    const {x,y}=game.koPoint;
    const cx=margin+x*cellSize,cy=margin+y*cellSize;
    ctx.fillStyle='rgba(231,76,60,0.35)';
    ctx.beginPath();ctx.arc(cx,cy,cellSize*0.3,0,Math.PI*2);ctx.fill();
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
  ctx.shadowColor='rgba(0,0,0,0.35)';ctx.shadowBlur=cellSize*0.15;
  ctx.shadowOffsetX=1;ctx.shadowOffsetY=2;
  const rg=ctx.createRadialGradient(cx-r*0.35,cy-r*0.35,r*0.1,cx,cy,r);
  if(c===BLACK){rg.addColorStop(0,'#666');rg.addColorStop(0.5,'#222');rg.addColorStop(1,'#000');}
  else{rg.addColorStop(0,'#fff');rg.addColorStop(0.7,'#e8e8e8');rg.addColorStop(1,'#bdbdbd');}
  ctx.fillStyle=rg;
  ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fill();
  ctx.restore();
  if(c===WHITE){
    ctx.strokeStyle='rgba(0,0,0,0.15)';ctx.lineWidth=1;
    ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.stroke();
  }
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
  const x=(px-rect.left-margin)/cellSize;
  const y=(py-rect.top-margin)/cellSize;
  const rx=Math.round(x),ry=Math.round(y);
  if(rx<0||rx>=game.size||ry<0||ry>=game.size)return null;
  const cx=margin+rx*cellSize,cy=margin+ry*cellSize;
  const ax=px-rect.left-cx,ay=py-rect.top-cy;
  if(Math.sqrt(ax*ax+ay*ay)>cellSize*0.5)return null;
  return{x:rx,y:ry};
}

if(boardCanvas){
  boardCanvas.addEventListener('click',e=>{
    const pos=pixToPos(e.clientX,e.clientY);
    if(!canPlay(true)){
      if(!game)addLog('提示：遊戲尚未初始化','warn');
      return;
    }
    if(!pos){addLog('提示：請點擊棋盤線交叉點','warn');return;}
    doMove(pos.x,pos.y);
  });
  boardCanvas.addEventListener('mousemove',e=>{
    const pos=pixToPos(e.clientX,e.clientY);
    const c=JSON.stringify(pos)!==JSON.stringify(hoverPos);
    if(c){hoverPos=pos;drawBoard();}
  });
  boardCanvas.addEventListener('mouseleave',()=>{if(hoverPos){hoverPos=null;drawBoard();}});
  let tsp=null;
  boardCanvas.addEventListener('touchstart',e=>{
    if(e.touches.length===1){const t=e.touches[0];tsp=pixToPos(t.clientX,t.clientY);}
  });
  boardCanvas.addEventListener('touchend',()=>{if(tsp&&canPlay()){doMove(tsp.x,tsp.y);}tsp=null;});
}
window.addEventListener('resize',()=>{if(game){setupCanvas();drawBoard();}});

/* ---------- Modal ---------- */
let modalCallback=null;
function showModal(title, body, callback){
  const t=$('modalTitle'),b=$('modalBody'),o=$('modalOverlay');
  if(t)t.textContent=title;
  if(b)b.innerHTML=body;
  modalCallback=callback;
  o?.classList.remove('hidden');
}
function closeModal(){
  $('modalOverlay')?.classList.add('hidden');
  modalCallback=null;
}
$('modalCancel')?.addEventListener('click',()=>{const cb=modalCallback;closeModal();if(cb)cb(false);});
$('modalOk')?.addEventListener('click',()=>{const cb=modalCallback;closeModal();if(cb)cb(true);});
$('modalOverlay')?.addEventListener('click',e=>{if(e.target.id==='modalOverlay'){const cb=modalCallback;closeModal();if(cb)cb(false);}});

$('passBtn')?.addEventListener('click',()=>{if(canPlay())doPass();});
$('undoBtn')?.addEventListener('click',requestUndo);
$('newGameBtn')?.addEventListener('click',()=>{
  showModal('確認新對局','確定要捨棄目前對局，開始新對局嗎？',ok=>{
    if(!ok)return;
    doNewGame(false);
  });
});
$('leaveBtn')?.addEventListener('click',leaveGame);

$('copyRoomBtn')?.addEventListener('click',()=>{
  const v=$('p2pRoomCode')?.value;
  if(!v)return;
  copy(v);
  addLog('邀請碼已複製：'+v,'system');
});
$('shareRoomBtn')?.addEventListener('click',()=>{
  const v=$('p2pRoomCode')?.value;
  if(!v)return;
  const url=location.origin+location.pathname+'?room='+v;
  if(navigator.share){
    navigator.share({title:'線上圍棋對戰邀請',text:'邀請碼：'+v,url}).catch(()=>{});
  }else{
    copy(url);
    addLog('已複製邀請連結：'+url,'system');
    try{alert('邀請連結已複製到剪貼簿：\n'+url);}catch(e){}
  }
});

function copy(v){if(v)navigator.clipboard?.writeText(v).catch(()=>{});}

function showLobbyHome(){
  $('lobbyHome')?.classList.remove('hidden');
  $('p2pHostScreen')?.classList.add('hidden');
  $('p2pJoinScreen')?.classList.add('hidden');
  try{closeP2P();}catch(e){}
  showResumeCardIfAvailable();
}
function showHostScreen(){
  $('lobbyHome')?.classList.add('hidden');
  $('p2pHostScreen')?.classList.remove('hidden');
  $('p2pJoinScreen')?.classList.add('hidden');
}
function showJoinScreen(){
  $('lobbyHome')?.classList.add('hidden');
  $('p2pHostScreen')?.classList.add('hidden');
  $('p2pJoinScreen')?.classList.remove('hidden');
}

document.querySelectorAll('[data-action]').forEach(el=>{
  el.addEventListener('click',()=>handleAction(el.dataset.action));
});
$('backFromHost')?.addEventListener('click',showLobbyHome);
$('backFromJoin')?.addEventListener('click',showLobbyHome);

$('submitRoomBtn')?.addEventListener('click',()=>{
  const v=($('p2pRoomInput')?.value||'').trim().toUpperCase();
  if(!v||v.length<4){try{alert('請輸入 4~8 位邀請碼');}catch(e){}return;}
  peerJoinRoom(v);
});
$('p2pRoomInput')?.addEventListener('keydown',e=>{
  if(e.key==='Enter')$('submitRoomBtn')?.click();
});

function handleAction(act){
  const radios=document.querySelectorAll('input[name="boardSize"]');
  let size=19;
  radios.forEach(r=>{if(r.checked)size=parseInt(r.value);});
  if(act==='hotseat'){
    startGame('hotseat',size,BLACK);
  }else if(act==='local-start'){
    startLocal(true,size);
  }else if(act==='local-join'){
    startLocal(false,size);
  }else if(act==='p2p-host'){
    showHostScreen();
    peerHostRoom(size);
  }else if(act==='goto-join'){
    showJoinScreen();
    $('p2pRoomInput').value='';
    setP2PStatus('join','輸入房主提供的 6 位邀請碼後送出，立即加入對局（可中途接手）','');
    setTimeout(()=>$('p2pRoomInput').focus(),100);
  }else if(act==='p2p-join'){
    showJoinScreen();
    $('p2pRoomInput').value='';
    setP2PStatus('join','輸入邀請碼後點擊送出即可加入','');
  }
}

function startGame(m, size, color){
  mode=m;myColor=color;
  game=new GoGame(size);
  lobby?.classList.add('hidden');gameScreen?.classList.remove('hidden');
  const cm=$('connMode'),mr=$('myRole'),ml=$('messageLog');
  if(cm)cm.textContent=m==='hotseat'?'單機雙人':(m==='local'?'分頁連線':'P2P 線上');
  if(mr)mr.textContent=m==='hotseat'?'雙人共用畫面':((color===BLACK?'黑棋 (先手)':'白棋 (後手)'));
  if(ml)ml.innerHTML='';
  pendingUndo=false;undoRequestFrom=null;
  addLog('對局開始！棋盤 '+size+'×'+size,'system');
  if(m==='hotseat'){
    setConnStatus('已就緒','ok');
    setPlayerStatus(BLACK,'已就緒');
    setPlayerStatus(WHITE,'已就緒');
  }else{
    setPlayerStatus(color,'已就緒');
    const otherColor=color===BLACK?WHITE:BLACK;
    setPlayerStatus(otherColor,'等待中');
  }
  updateUI();
  saveGameToStorage();
  const retryDraw=(n)=>{
    if(n<=0)return;
    requestAnimationFrame(()=>{
      try{setupCanvas();drawBoard();}catch(e){}
      setTimeout(()=>retryDraw(n-1),120);
    });
  };
  retryDraw(4);
}

function resumeGame(m, color){
  mode=m;myColor=color;
  lobby?.classList.add('hidden');gameScreen?.classList.remove('hidden');
  const cm=$('connMode'),mr=$('myRole');
  if(cm)cm.textContent=m==='hotseat'?'單機雙人':(m==='local'?'分頁連線':'P2P 線上（恢復）');
  if(mr)mr.textContent=m==='hotseat'?'雙人共用畫面':((color===BLACK?'黑棋 (接手)':'白棋 (接手)'));
  pendingUndo=false;undoRequestFrom=null;
  addLog('恢復 '+ (m==='hotseat'?'對局':((color===BLACK?'黑棋':'白棋'))) + '，繼續對局！','good');
  if(m==='hotseat'){
    setPlayerStatus(BLACK,'已就緒');
    setPlayerStatus(WHITE,'已就緒');
    setConnStatus('已就緒','ok');
  }else{
    setPlayerStatus(myColor,'已就緒');
    const otherColor=myColor===BLACK?WHITE:BLACK;
    setPlayerStatus(otherColor,'等待連線');
  }
  updateUI();
  saveGameToStorage();
  const retryDraw=(n)=>{
    if(n<=0)return;
    requestAnimationFrame(()=>{
      try{setupCanvas();drawBoard();}catch(e){addLog('繪製重試失敗: '+e.message,'error');}
      setTimeout(()=>retryDraw(n-1),120);
    });
  };
  retryDraw(6);
  addLog('目前輪到 '+ (game.currentPlayer===BLACK?'黑棋':'白棋') + ' 落子（你是 '+(myColor===BLACK?'黑棋':'白棋')+(m==='hotseat'?' - 雙人模式可直接下棋':'')+'）','system');
}

function applyMoveRemote(r){
  if(!r.ok){addLog(r.msg,'error');return;}
  if(!game)return;
  const prevHash=game.hash();
  if(r.captured&&r.captured.length){
    for(const[cx,cy]of r.captured) game.board[cx][cy]=EMPTY;
  }
  game.board[r.x][r.y]=r.player;
  const next=r.player===BLACK?WHITE:BLACK;
  game.currentPlayer=next;
  game.captures=r.captures;
  game.lastMove=r.lastMove;
  game.koPoint=r.koPoint;
  game.passCount=(typeof r.passCount==='number')?r.passCount:0;
  game.history.push({hash:prevHash,move:{x:r.x,y:r.y,p:r.player},captured:r.captured||[],koPoint:r.koPoint?{...r.koPoint}:null});
  addLog(`${r.player===BLACK?'黑':'白'} 落子 (${r.x+1}, ${r.y+1})`);
  if(r.captured&&r.captured.length) addLog(`提子 ${r.captured.length} 顆`);
  updateUI();drawBoard();
  saveGameToStorage();
}

function applyPassRemote(r){
  if(!game)return;
  const prevHash=game.hash();
  game.captures=r.captures;
  game.history.push({hash:prevHash,move:{pass:true,p:r.passingPlayer},captured:[],koPoint:null});
  game.currentPlayer=r.nextPlayer;
  game.lastMove=null;game.koPoint=null;
  game.passCount=(typeof r.passCount==='number')?r.passCount:1;
  if(r.gameOver){game.gameOver=true;addLog('雙方連續虛手，對局結束！','system');}
  else addLog(`${r.passingPlayer===BLACK?'黑':'白'} 虛手 (Pass)`,'system');
  updateUI();drawBoard();
  saveGameToStorage();
}

function doMove(x,y){
  if(!game)return;
  const r=game.place(x,y);
  if(!r.ok){addLog(r.msg,'error');return;}
  addLog(`${r.player===BLACK?'黑':'白'} 落子 (${r.x+1}, ${r.y+1})`);
  if(r.captured.length) addLog(`提子 ${r.captured.length} 顆`);
  sendMessage({type:'move',result:r});
  updateUI();drawBoard();
  saveGameToStorage();
}
function doPass(){
  if(!game)return;
  const r=game.pass();
  if(!r.ok){addLog(r.msg,'error');return;}
  if(r.gameOver) addLog('雙方連續虛手，對局結束！','system');
  else addLog(`${r.passingPlayer===BLACK?'黑':'白'} 虛手 (Pass)`,'system');
  sendMessage({type:'pass',result:r});
  updateUI();drawBoard();
  saveGameToStorage();
}
function doNewGame(fromRemote=false){
  if(!game)return;
  game.reset();
  pendingUndo=false;undoRequestFrom=null;
  addLog('新對局開始！','system');
  if(!fromRemote)sendMessage({type:'newGame'});
  updateUI();drawBoard();
  saveGameToStorage();
}

function sendMessage(msg){
  if(transport){try{transport.send(msg);return true;}catch(e){}}
  if(peerConn&&peerConn.open){
    try{peerConn.send(JSON.stringify(msg));return true;}catch(e){}
  }
  for(const c of peerConnections){
    try{if(c&&c.open){c.send(JSON.stringify(msg));return true;}}catch(e){}
  }
  return false;
}

function requestUndo(){
  if(!game||game.history.length===0){addLog('目前無棋可悔','error');return;}
  if(mode==='hotseat'){
    const r=game.undo();
    if(r.ok){addLog('已悔棋一步','system');updateUI();drawBoard();saveGameToStorage();}
    return;
  }
  if(pendingUndo){addLog('已有一個悔棋請求等待回應中...','warn');return;}
  const last=game.history[game.history.length-1];
  const lastPlayer=last.move.p;
  if(lastPlayer!==myColor){
    const who=lastPlayer===BLACK?'黑棋':'白棋';
    addLog('只能悔自己走的棋！最後一步是 '+who+' 下的','error');
    return;
  }
  const ok=sendMessage({type:'undoRequest',player:myColor});
  if(!ok){addLog('未連線對手，無法請求悔棋','error');return;}
  pendingUndo=true;
  addLog('已送出悔棋請求，等待對手同意...','system');
}

function onUndoRequest(fromColor){
  if(!game||game.history.length===0){
    addLog('收到悔棋請求，但棋盤無歷史紀錄','warn');
    sendMessage({type:'undoReject',player:myColor,msg:'無棋可悔'});
    return;
  }
  const last=game.history[game.history.length-1];
  const lastPlayer=last.move.p;
  if(lastPlayer!==fromColor){
    const askWho=fromColor===BLACK?'黑棋':'白棋';
    const lastWho=lastPlayer===BLACK?'黑棋':'白棋';
    addLog(askWho+' 請求悔棋，但最後一步是 '+lastWho+' 下的，已拒絕','error');
    sendMessage({type:'undoReject',player:myColor,msg:'只能悔自己的棋'});
    return;
  }
  undoRequestFrom=fromColor;
  const who=fromColor===BLACK?'黑棋':'白棋';
  showModal('悔棋請求',`${who} 請求悔棋，是否同意？`,agree=>{
    if(agree){
      const r=game.undo();
      if(r.ok){
        addLog('已悔棋一步 (撤銷 '+who+' 的最後一步)','system');
        updateUI();drawBoard();
        const state=game.getFullState();
        sendMessage({type:'undoAccept',player:myColor,state:state});
        addLog('你已同意對方悔棋，已同步棋盤狀態','system');
        saveGameToStorage();
      }else{
        addLog('悔棋失敗：'+r.msg,'error');
        sendMessage({type:'undoReject',player:myColor,msg:r.msg});
      }
    }else{
      sendMessage({type:'undoReject',player:myColor});
      addLog('你已拒絕對方悔棋','system');
    }
    undoRequestFrom=null;
  });
}

function onUndoAccept(msg){
  if(!pendingUndo)return;
  pendingUndo=false;
  if(msg&&msg.state){
    game.loadFullState(msg.state);
    addLog('對手同意！已成功悔棋一步，棋盤已同步','good');
  }else{
    addLog('對手同意悔棋，但未收到同步狀態，請手動確認棋盤','warn');
  }
  updateUI();
  drawBoard();
  saveGameToStorage();
  setTimeout(()=>{try{drawBoard();}catch(e){}},50);
  setTimeout(()=>{try{drawBoard();}catch(e){}},200);
}

function onUndoReject(){
  pendingUndo=false;
  addLog('對手拒絕了你的悔棋請求','error');
}

function updateUI(){
  if(!game)return;
  const bcv=$('blackCaptures'), wcv=$('whiteCaptures');
  if(bcv)bcv.textContent=game.captures[BLACK];
  if(wcv)wcv.textContent=game.captures[WHITE];
  const bc=$('blackCard');
  const wc=$('whiteCard');
  bc?.classList.toggle('active',!game.gameOver&&game.currentPlayer===BLACK);
  wc?.classList.toggle('active',!game.gameOver&&game.currentPlayer===WHITE);
  const ind=$('turnIndicator'),txt=$('turnText');
  if(ind){
    ind.classList.remove('active-black','active-white','my-turn','game-over');
    if(game.gameOver){
      ind.classList.add('game-over');
      const bs=game.captures[BLACK],ws=game.captures[WHITE]+6.5;
      if(txt)txt.innerHTML=`對局結束！<br>黑提子 ${game.captures[BLACK]} · 白提子 ${game.captures[WHITE]} (+6.5 貼目)<br>${bs>ws?'黑棋領先':'白棋領先'} ${Math.abs(bs-ws).toFixed(1)} 目（僅計算提子）`;
    }else{
      if(game.currentPlayer===BLACK)ind.classList.add('active-black');else ind.classList.add('active-white');
      const name=game.currentPlayer===BLACK?'黑棋':'白棋';
      let suf='';
      if(mode!=='hotseat'){
        suf=myColor===game.currentPlayer?' · 輪到你':' · 等待對手';
        if(myColor===game.currentPlayer)ind.classList.add('my-turn');
      }
      if(txt)txt.textContent=name+suf;
    }
  }
  const pb=$('passBtn'),ub=$('undoBtn');
  if(pb)pb.disabled=!canPlay();
  if(ub)ub.disabled=!(game && game.history && game.history.length>0) || pendingUndo;
}

function leaveGame(){
  if(transport){try{transport.close();}catch(e){}transport=null;}
  if(peerInst){try{peerInst.destroy();}catch(e){}peerInst=null;}
  peerConnections.clear();
  peerConn=null;
  pendingUndo=false;undoRequestFrom=null;
  hoverPos=null;
  clearSavedGame();
  game=null;mode=null;
  gameScreen?.classList.add('hidden');
  lobby?.classList.remove('hidden');
  showLobbyHome();
  if($('p2pRoomCode'))$('p2pRoomCode').value='';
  if($('p2pRoomInput'))$('p2pRoomInput').value='';
}

/* ---------- BroadcastChannel 分頁連線 ---------- */
function startLocal(isHost, size){
  if(typeof BroadcastChannel==='undefined'){
    alert('此瀏覽器不支援 BroadcastChannel，請改用 P2P 模式');
    return;
  }
  const color=isHost?BLACK:WHITE;
  const ch=new BroadcastChannel('go-local-match-v2');
  let otherReady=false;
  const myNonce=Math.random().toString(36).slice(2);
  const t={
    send(msg){try{ch.postMessage({...msg,_from:myNonce});}catch(e){}},
    close(){try{ch.close();}catch(e){}}
  };
  transport=t;
  ch.onmessage=(e)=>{
    const m=e.data;
    if(!m||m._from===myNonce)return;
    if(m.type==='hello'){
      otherReady=true;
      setConnStatus('對手已就緒','ok');
      setPlayerStatus(WHITE,'已就緒');
      addLog('對手已就緒，開始對弈','good');
      t.send({type:'helloAck',size:game?game.size:size});
    }else if(m.type==='helloAck'){
      otherReady=true;
      setConnStatus('連線成功','ok');
      setPlayerStatus(BLACK,'已就緒');
      addLog('連線成功！開始對弈','good');
    }else if(m.type==='move'){
      applyMoveRemote(m.result);
    }else if(m.type==='pass'){
      applyPassRemote(m.result);
    }else if(m.type==='newGame'){
      doNewGame(true);
    }else if(m.type==='undoRequest'){
      onUndoRequest(m.player);
    }else if(m.type==='undoAccept'){
      onUndoAccept(m);
    }else if(m.type==='undoReject'){
      onUndoReject();
    }
  };
  startGame('local',size,color);
  setConnStatus(isHost?'等待對手開啟另一分頁...':'嘗試連線房主...','warn');
  addLog(isHost?'請在同一瀏覽器開新分頁並點「分頁加入」':'正在與房主分頁連線...','system');
  t.send({type:'hello'});
  setTimeout(()=>{if(!otherReady){addLog('提示：對手需在同瀏覽器新分頁中點擊「分頁加入」按鈕','system');}},1500);
}

/* ---------- PeerJS P2P (房間邀請碼，支援中途接手 + 房主自動轉移) ---------- */
let peerInst=null, peerConn=null, p2pSize=19, p2pRole=null, peerLoaded=(typeof Peer!=='undefined');
let p2pRoomCode=null;
let isHost=false;
let hostTakeoverInProgress=false;
let hostTakeoverTimer=null;

function loadPeerJSFallback(){
  if(peerLoaded)return Promise.resolve(true);
  return new Promise(res=>{
    const s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
    s.onload=()=>{peerLoaded=true;res(true);};
    s.onerror=()=>res(false);
    document.head.appendChild(s);
  });
}

function genRoomCode(){
  const s='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c='';
  for(let i=0;i<6;i++) c+=s[Math.floor(Math.random()*s.length)];
  return c;
}

function attachPeerHandlers(size, role){
  p2pSize=size; p2pRole=role;
  let opened=false;
  peerInst.on('open',id=>{
    opened=true;
    if(role==='host'){
      const code=p2pRoomCode;
      if($('p2pRoomCode'))$('p2pRoomCode').value=code;
      setP2PStatus('host','就緒！邀請碼 '+code+'，等待對手加入...（對手離線時新朋友可接手）','ok');
      if(game){
        setConnStatus('🔗 房主連線就緒（邀請碼 '+code+'），等待對手加入/接手','ok');
        addLog('房主重新連線就緒，邀請碼 '+code+' 已開放對手接手','good');
      }else{
        addLog('邀請碼 '+code+' 已生效，等待對手加入','system');
      }
      saveGameToStorage();
    }
  });
  peerInst.on('connection',conn=>{
    let takeOverColor=null;
    let existingConn=peerConn;
    conn.on('open',()=>{
      addLog('有新玩家嘗試連線房間...','system');
      conn.on('data',raw=>{
        try{
          const m=typeof raw==='string'?JSON.parse(raw):raw;
          if(!m||!m.type)return;
          if(m.type==='hello'){
            if(game && existingConn && existingConn.open){
              takeOverColor=null;
              conn.send(JSON.stringify({type:'roomFull',msg:'房間已滿，兩位玩家都在線上'}));
              setTimeout(()=>{try{conn.close();}catch(e){}},500);
              return;
            }
            if(game){
              const needBlack=myColor!==BLACK;
              const needWhite=myColor!==WHITE;
              let assigned=null;
              if(m.preferColor){
                if(m.preferColor===BLACK && needBlack)assigned=BLACK;
                else if(m.preferColor===WHITE && needWhite)assigned=WHITE;
              }
              if(!assigned){
                if(needBlack)assigned=BLACK;
                else if(needWhite)assigned=WHITE;
                else assigned=null;
              }
              if(!assigned){
                conn.send(JSON.stringify({type:'roomFull',msg:'兩個位置都已被佔用'}));
                setTimeout(()=>{try{conn.close();}catch(e){}},500);
                return;
              }
              takeOverColor=assigned;
              const state=game.getFullState();
              conn.send(JSON.stringify({type:'takeOver',color:assigned,state}));
              addLog('新玩家接手 '+ (assigned===BLACK?'黑棋':'白棋') + '，同步對局狀態中...','good');
              setPlayerStatus(assigned,'已就緒');
            }else{
              peerConn=conn;
              peerConnections.add(conn);
              peerDataReady(conn, role==='host'?BLACK:WHITE, size);
            }
          }else if(m.type==='takeOverAck'){
            if(takeOverColor){
              if(existingConn && existingConn !== conn){
                try{existingConn.close();}catch(e){}
                peerConnections.delete(existingConn);
              }
              if(peerConn && peerConn !== conn && peerConn !== existingConn){
                try{peerConn.close();}catch(e){}
                peerConnections.delete(peerConn);
              }
              peerConn=conn;
              peerConnections.add(conn);
              transport={
                send(msg){try{conn.send(JSON.stringify(msg));}catch(e){addLog('傳送失敗','error');}},
                close(){try{conn.close();}catch(e){}}
              };
              installConnHandlers(conn);
              setConnStatus('新玩家已接手並連線成功','ok');
              addLog((takeOverColor===BLACK?'黑棋':'白棋') + ' 玩家接手成功，繼續對局！','good');
              saveGameToStorage();
            }
          }
        }catch(e){
          addLog('連線握手異常：'+e.message,'error');
        }
      });
      conn.send(JSON.stringify({type:'helloAck',hasGame:!!game,myColor:myColor}));
    });
    conn.on('error',err=>addLog('P2P 連線錯誤：'+JSON.stringify(err),'error'));
  });
  peerInst.on('disconnected',()=>{
    if(!game){
      setP2PStatus(role,'與信令伺服器斷線，嘗試重新連線...','warn');
      setTimeout(()=>{try{peerInst&&peerInst.reconnect();}catch(e){}},1000);
    }
  });
  peerInst.on('error',err=>{
    const t=err&&err.type?err.type:'';
    const msg=err&&err.message?err.message:String(err);
    if(t==='unavailable-id'&&role==='host'){
      setP2PStatus('host','邀請碼暫時被占用（信令伺服器尚未釋放），10 秒後重試...','warn');
      addLog('邀請碼 ID 占用中，自動重試...','warn');
      const savedCode=p2pRoomCode;
      setTimeout(()=>{
        try{if(peerInst)peerInst.destroy();}catch(e){}
        peerInst=null;
        peerHostRoom(size,savedCode,true);
      },10000);
    }else if(t==='peer-unavailable'){
      if(role==='join'){
        setP2PStatus('join','找不到此邀請碼，確認是否正確','error');
      }
    }else if(t==='network'||t==='disconnected'||msg.includes('network')){
      setP2PStatus(role,'網路不穩，請檢查連線後重整','warn');
    }else if(t==='invalid-id'||msg.includes('Invalid')){
      setP2PStatus(role,'邀請碼格式錯誤','error');
    }else{
      setP2PStatus(role,'錯誤：'+(t||msg),'error');
      addLog('Peer 錯誤：'+t+' '+msg,'error');
    }
  });
}

function installConnHandlers(conn){
  conn.on('data',raw=>{
    try{
      const m=typeof raw==='string'?JSON.parse(raw):raw;
      if(!m||!m.type)return;
      if(m.type==='move')applyMoveRemote(m.result);
      else if(m.type==='pass')applyPassRemote(m.result);
      else if(m.type==='newGame')doNewGame(true);
      else if(m.type==='undoRequest')onUndoRequest(m.player);
      else if(m.type==='undoAccept')onUndoAccept(m);
      else if(m.type==='undoReject')onUndoReject();
    }catch(e){
      addLog('收到異常資料：'+e.message,'error');
    }
  });
  conn.on('close',()=>{
    if(game){
      addLog('對手已離線！等待新玩家前來接手...','error');
      setConnStatus('對手離線 - 等待接手','off');
      const otherColor=myColor===BLACK?WHITE:BLACK;
      setPlayerStatus(otherColor,'等待接手');
      if(peerConn===conn)peerConn=null;
      peerConnections.delete(conn);
      saveGameToStorage();
      addLog('提示：邀請碼 '+p2pRoomCode+' 仍然有效！將邀請碼傳送給新朋友即可接手 '+
        (otherColor===BLACK?'黑棋':'白棋') + ' 繼續對局。','system');
    }
  });
  conn.on('error',err=>{addLog('連線錯誤：'+JSON.stringify(err),'error');});
}

async function peerHostRoom(size, fixedCode=null, isRetry=false){
  if(!fixedCode)setP2PStatus('host','連接 PeerJS 信令伺服器中...','pending');
  const code=fixedCode||genRoomCode();
  const samePeerAlive = peerInst && !peerInst.destroyed && (peerInst._roomCode===code);
  if(samePeerAlive){
    p2pRoomCode=code;
    roomCodeShared=code;
    if($('p2pRoomCode'))$('p2pRoomCode').value=code;
    addLog('偵測到存活的房主連線，直接複用（不重建）','system');
    if(game){
      setConnStatus('🔗 房主連線仍在（邀請碼 '+code+'），等待對手加入/接手','ok');
      setP2PStatus('host','就緒！邀請碼 '+code+'，等待對手加入...（複用既有連線）','ok');
    }
    return;
  }
  if(peerInst){try{peerInst.destroy();}catch(e){}peerInst=null;}
  if(!samePeerAlive){peerConnections.clear();peerConn=null;}
  if(!peerLoaded){
    setP2PStatus('host','載入 PeerJS 模組中...','pending');
    const ok=await loadPeerJSFallback();
    if(!ok){setP2PStatus('host','無法載入 PeerJS（可能連線受限制），建議改用「分頁對弈」模式','error');return;}
  }
  p2pRoomCode=code;
  roomCodeShared=code;
  let tryCount=0;
  const make=()=>{
    try{
      peerInst=new Peer('GO-'+code,{
        debug:1,
        config:{iceServers:[
          {urls:'stun:stun.l.google.com:19302'},
          {urls:'stun:stun1.l.google.com:19302'},
          {urls:'stun:stun2.l.google.com:19302'}
        ]}
      });
      peerInst._roomCode=code;
      if($('p2pRoomCode'))$('p2pRoomCode').value=code;
      attachPeerHandlers(size,'host');
    }catch(e){
      if(tryCount++<2){setTimeout(make,500);}
      else setP2PStatus('host','建立失敗：'+e.message,'error');
    }
  };
  make();
}

async function peerJoinRoom(code){
  code=code.toUpperCase().trim();
  if(!/^[A-Z2-9]{4,8}$/.test(code)){
    setP2PStatus('join','邀請碼格式錯誤（應為 4~8 位英數字）','error');return;
  }
  p2pRoomCode=code;
  setP2PStatus('join','正在連接房間 '+code+' ...（支援中途接手）','pending');
  if(peerInst){try{peerInst.destroy();}catch(e){}peerInst=null;}
  peerConnections.clear();peerConn=null;
  if(!peerLoaded){
    setP2PStatus('join','載入 PeerJS 模組中...','pending');
    const ok=await loadPeerJSFallback();
    if(!ok){setP2PStatus('join','無法載入 PeerJS（可能連線受限制），建議改用「分頁對弈」模式','error');return;}
  }
  const size=19;
  let timeout=setTimeout(()=>{
    if(!game)setP2PStatus('join','連線逾時，請確認邀請碼正確、房主仍在線或對手位置有空缺','warn');
  },20000);
  try{
    peerInst=new Peer({
      debug:1,
      config:{iceServers:[
        {urls:'stun:stun.l.google.com:19302'},
        {urls:'stun:stun1.l.google.com:19302'}
      ]}
    });
  }catch(e){
    clearTimeout(timeout);
    setP2PStatus('join','建立 Peer 失敗：'+e.message,'error');return;
  }
  attachPeerHandlers(size,'join');
  peerInst.on('open',()=>{
    try{
      const c=peerInst.connect('GO-'+code,{reliable:true,serialization:'json'});
      let opened=false;
      c.on('open',()=>{
        opened=true;
        peerConn=c;
        peerConnections.add(c);
        c.send(JSON.stringify({type:'hello'}));
        let setupDone=false;
        c.on('data',raw=>{
          try{
            const m=typeof raw==='string'?JSON.parse(raw):raw;
            if(!m||!m.type)return;
            if(setupDone){
              if(m.type==='move')applyMoveRemote(m.result);
              else if(m.type==='pass')applyPassRemote(m.result);
              else if(m.type==='newGame')doNewGame(true);
              else if(m.type==='undoRequest')onUndoRequest(m.player);
              else if(m.type==='undoAccept')onUndoAccept(m);
              else if(m.type==='undoReject')onUndoReject();
              return;
            }
            if(m.type==='helloAck'){
              if(!m.hasGame){
                clearTimeout(timeout);
                setupDone=true;
                peerDataReady(c, WHITE, size);
              }
            }else if(m.type==='takeOver'){
              clearTimeout(timeout);
              setupDone=true;
              const assignedColor=m.color;
              game=new GoGame(m.state.size);
              game.loadFullState(m.state);
              resumeGame('p2p', assignedColor);
              transport={
                send(msg){try{c.send(JSON.stringify(msg));}catch(e){addLog('傳送失敗','error');}},
                close(){try{c.close();}catch(e){}}
              };
              setConnStatus('接手成功！P2P 連線正常','ok');
              setPlayerStatus(assignedColor,'已就緒');
              const other=assignedColor===BLACK?WHITE:BLACK;
              setPlayerStatus(other,'房主在線');
              installConnHandlers(c);
              c.send(JSON.stringify({type:'takeOverAck',color:assignedColor}));
            }else if(m.type==='roomFull'){
              clearTimeout(timeout);
              setP2PStatus('join',(m.msg||'房間已滿，請稍後再試'),'error');
              try{c.close();}catch(e){}
            }
          }catch(e){
            addLog('連線資料錯誤：'+e.message,'error');
          }
        });
        c.on('close',()=>{
          if(!setupDone)return;
          if(game){
            addLog('對手已離線！等待新玩家接手...','error');
            setConnStatus('對手離線 - 等待接手','off');
            const otherColor=myColor===BLACK?WHITE:BLACK;
            setPlayerStatus(otherColor,'等待接手');
            addLog('邀請碼 '+p2pRoomCode+' 仍然有效，可傳送給新朋友繼續接手對局！','system');
            peerConnections.delete(c);
            if(peerConn===c)peerConn=null;
            saveGameToStorage();
          }
        });
        c.on('error',err=>{clearTimeout(timeout);setP2PStatus('join','連線失敗：'+JSON.stringify(err),'error');});
      });
      setTimeout(()=>{if(!opened&&!game){setP2PStatus('join','房主未回應，確認房主是否仍在線上','warn');}},12000);
    }catch(e){
      clearTimeout(timeout);
      setP2PStatus('join','連線失敗：'+e.message,'error');
    }
  });
}

function peerDataReady(conn, color, size){
  transport={
    send(msg){try{conn.send(JSON.stringify(msg));}catch(e){addLog('傳送失敗','error');}},
    close(){try{conn.close();}catch(e){}}
  };
  installConnHandlers(conn);
  if(!game) startGame('p2p',size,color);
  setConnStatus('P2P 連線成功','ok');
  setPlayerStatus(color===BLACK?WHITE:BLACK,'已就緒');
  addLog('已建立 WebRTC 點對點連線，開始對弈！你是 '+(color===BLACK?'黑棋 (先手)':'白棋 (後手)'),'good');
  saveGameToStorage();
}

function closeP2P(){
  for(const c of peerConnections){try{c.close();}catch(e){}}
  peerConnections.clear();
  if(peerConn){try{peerConn.close();}catch(e){}peerConn=null;}
  if(peerInst){try{peerInst.destroy();}catch(e){}peerInst=null;}
  p2pRole=null;
}

/* ---------- 自動偵測 URL 裡的 ?room= 參數 ---------- */
(function autoJoin(){
  const run=()=>{
    try{
      showResumeCardIfAvailable();
      const params=new URLSearchParams(location.search);
      const r=params.get('room');
      if(r&&r.length>=4){
        setTimeout(()=>{
          showJoinScreen();
          $('p2pRoomInput').value=r.toUpperCase();
          setP2PStatus('join','偵測到邀請碼 '+r.toUpperCase()+'，自動連線中...（可中途接手）','pending');
          addLog('偵測到連結邀請碼：'+r.toUpperCase()+'，正在自動加入','system');
          setTimeout(()=>peerJoinRoom(r),300);
        },200);
      }
    }catch(e){}
  };
  if(document.readyState==='complete'||document.readyState==='interactive'){
    run();
  }else{
    window.addEventListener('DOMContentLoaded',run,{once:true});
  }
})();

window.addEventListener('error',e=>{
  addLog('執行錯誤：'+(e&&e.message?e.message:String(e)),'error');
  console.error(e);
});

window.addEventListener('beforeunload',()=>{
  saveGameToStorage();
});

addLog('系統就緒，請選擇對戰模式','system');
