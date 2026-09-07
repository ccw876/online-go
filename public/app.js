const EMPTY = 0, BLACK = 1, WHITE = 2;

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
    return{ok:true,x,y,player:played,captured:cap,captures:{...this.captures},koPoint:this.koPoint,lastMove:this.lastMove};
  }
  pass(){
    if(this.gameOver)return{ok:false,msg:'遊戲已結束'};
    this.passCount++;
    this.history.push({hash:this.hash(),move:{pass:true,p:this.currentPlayer},captured:[],koPoint:null});
    this.koPoint=null;this.lastMove=null;
    const passing=this.currentPlayer;
    this.currentPlayer=this.currentPlayer===BLACK?WHITE:BLACK;
    if(this.passCount>=2)this.gameOver=true;
    return{ok:true,pass:true,passingPlayer:passing,nextPlayer:this.currentPlayer,gameOver:this.gameOver,captures:{...this.captures}};
  }
  reset(){
    this.board=Array.from({length:this.size},()=>Array(this.size).fill(EMPTY));
    this.currentPlayer=BLACK;this.captures={[BLACK]:0,[WHITE]:0};this.history=[];
    this.koPoint=null;this.lastMove=null;this.passCount=0;this.gameOver=false;
  }
}

const lobby = document.getElementById('lobby');
const gameScreen = document.getElementById('gameScreen');
const boardCanvas = document.getElementById('boardCanvas');
const ctx = boardCanvas.getContext('2d');

let game = null;
let mode = null;
let myColor = BLACK;
let cellSize = 30;
let margin = 30;
let hoverPos = null;
let transport = null;

function $(id){return document.getElementById(id);}
function b64encode(str){return btoa(unescape(encodeURIComponent(str)));}
function b64decode(str){try{return decodeURIComponent(escape(atob(str)));}catch(e){return null;}}

function addLog(text, cls=''){
  const el=document.createElement('div');
  el.className='log-entry '+cls;
  const t=new Date().toLocaleTimeString('zh-TW',{hour12:false});
  el.textContent=`[${t}] ${text}`;
  const log=$('messageLog');
  log.appendChild(el);log.scrollTop=log.scrollHeight;
}

function setConnStatus(text, cls='ok'){
  const s=$('connStatus');
  if(s){s.textContent=text;s.className='badge '+cls;}
}

function setP2PStatus(which, text, cls=''){
  const id=which==='host'?'p2pHostStatus':'p2pJoinStatus';
  const el=$(id);
  if(!el)return;
  el.textContent=text;
  el.className='status-bar '+cls;
}

function canPlay(){
  if(!game||game.gameOver)return false;
  if(mode==='hotseat')return true;
  return game.currentPlayer===myColor;
}

function setupCanvas(){
  if(!game)return;
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
  if(!game)return;
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

boardCanvas.addEventListener('click',e=>{
  const pos=pixToPos(e.clientX,e.clientY);
  if(!pos||!canPlay())return;
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
window.addEventListener('resize',()=>{if(game){setupCanvas();drawBoard();}});

$('passBtn').onclick=()=>{if(canPlay())doPass();};
$('newGameBtn').onclick=()=>{
  if(!confirm('確定要開始新對局嗎？'))return;
  if(transport)transport.send({type:'newGame'});
  else doNewGame();
};
$('leaveBtn').onclick=leaveGame;

$('copyRoomBtn').onclick=()=>{
  const v=$('p2pRoomCode').value;
  if(!v)return;
  copy(v);
  addLog('邀請碼已複製：'+v,'system');
};
$('shareRoomBtn').onclick=()=>{
  const v=$('p2pRoomCode').value;
  if(!v)return;
  const url=location.origin+location.pathname+'?room='+v;
  if(navigator.share){
    navigator.share({title:'線上圍棋對戰邀請',text:'邀請碼：'+v,url}).catch(()=>{});
  }else{
    copy(url);
    addLog('已複製邀請連結：'+url,'system');
    alert('邀請連結已複製到剪貼簿：\n'+url);
  }
};

function copy(v){if(v)navigator.clipboard.writeText(v);}

function showLobbyHome(){
  $('lobbyHome').classList.remove('hidden');
  $('p2pHostScreen')?.classList.add('hidden');
  $('p2pJoinScreen')?.classList.add('hidden');
  closeP2P();
}
function showHostScreen(){
  $('lobbyHome').classList.add('hidden');
  $('p2pHostScreen').classList.remove('hidden');
  $('p2pJoinScreen').classList.add('hidden');
}
function showJoinScreen(){
  $('lobbyHome').classList.add('hidden');
  $('p2pHostScreen').classList.add('hidden');
  $('p2pJoinScreen').classList.remove('hidden');
}

document.querySelectorAll('[data-action]').forEach(el=>{
  el.onclick=()=>handleAction(el.dataset.action);
});
if($('backFromHost'))$('backFromHost').onclick=showLobbyHome;
if($('backFromJoin'))$('backFromJoin').onclick=showLobbyHome;

$('submitRoomBtn').onclick=()=>{
  const v=$('p2pRoomInput').value.trim().toUpperCase();
  if(!v||v.length<4)return alert('請輸入 4~6 位邀請碼');
  peerJoinRoom(v);
};
$('p2pRoomInput').addEventListener('keydown',e=>{
  if(e.key==='Enter')$('submitRoomBtn').click();
});

function handleAction(act){
  const size=parseInt($('boardSize').value);
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
    setP2PStatus('join','輸入房主提供的 6 位邀請碼後送出，立即加入對局','');
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
  lobby.classList.add('hidden');gameScreen.classList.remove('hidden');
  $('connMode').textContent=m==='hotseat'?'單機雙人':(m==='local'?'分頁連線':'P2P 線上');
  $('myRole').textContent=m==='hotseat'?'雙人共用畫面':((color===BLACK?'⚫ 黑棋 (先手)':'⚪ 白棋 (後手)'));
  $('messageLog').innerHTML='';
  addLog('🎮 對局開始！棋盤 '+size+'×'+size,'system');
  if(m==='hotseat'){
    setConnStatus('已就緒','ok');
  }
  updateUI();
  requestAnimationFrame(()=>{setupCanvas();drawBoard();});
}

function applyMoveRemote(r){
  if(!r.ok){addLog(r.msg,'error');return;}
  if(!game)return;
  if(r.captured&&r.captured.length){
    for(const[cx,cy]of r.captured) game.board[cx][cy]=EMPTY;
  }
  game.board[r.x][r.y]=r.player;
  const next=r.player===BLACK?WHITE:BLACK;
  game.currentPlayer=next;
  game.captures=r.captures;
  game.lastMove=r.lastMove;
  game.koPoint=r.koPoint;
  game.passCount=0;
  addLog(`${r.player===BLACK?'⚫ 黑':'⚪ 白'} 落子 (${r.x+1}, ${r.y+1})`);
  if(r.captured&&r.captured.length) addLog(`提子 ${r.captured.length} 顆`);
  updateUI();drawBoard();
}

function applyPassRemote(r){
  if(!game)return;
  game.captures=r.captures;
  game.currentPlayer=r.nextPlayer;
  game.lastMove=null;game.koPoint=null;
  if(r.gameOver){game.gameOver=true;addLog('🏁 雙方連續虛手，對局結束！','system');}
  else addLog(`${r.passingPlayer===BLACK?'⚫ 黑':'⚪ 白'} 虛手 (Pass)`,'system');
  updateUI();drawBoard();
}

function doMove(x,y){
  if(!game)return;
  const r=game.place(x,y);
  if(!r.ok){addLog(r.msg,'error');return;}
  addLog(`${r.player===BLACK?'⚫ 黑':'⚪ 白'} 落子 (${r.x+1}, ${r.y+1})`);
  if(r.captured.length) addLog(`提子 ${r.captured.length} 顆`);
  if(transport) transport.send({type:'move',result:r});
  updateUI();drawBoard();
}
function doPass(){
  if(!game)return;
  const r=game.pass();
  if(!r.ok){addLog(r.msg,'error');return;}
  if(r.gameOver) addLog('🏁 雙方連續虛手，對局結束！','system');
  else addLog(`${r.passingPlayer===BLACK?'⚫ 黑':'⚪ 白'} 虛手 (Pass)`,'system');
  if(transport) transport.send({type:'pass',result:r});
  updateUI();drawBoard();
}
function doNewGame(){
  if(!game)return;
  game.reset();
  addLog('🆕 新對局開始！','system');
  updateUI();drawBoard();
}

function updateUI(){
  if(!game)return;
  $('blackCaptures').textContent=game.captures[BLACK];
  $('whiteCaptures').textContent=game.captures[WHITE];
  const bc=document.querySelector('.player-card.black');
  const wc=document.querySelector('.player-card.white');
  bc.classList.toggle('active',!game.gameOver&&game.currentPlayer===BLACK);
  wc.classList.toggle('active',!game.gameOver&&game.currentPlayer===WHITE);
  const ind=$('turnIndicator'),txt=$('turnText');
  ind.classList.remove('active-black','active-white','my-turn','game-over');
  if(game.gameOver){
    ind.classList.add('game-over');
    const bs=game.captures[BLACK],ws=game.captures[WHITE]+6.5;
    txt.innerHTML=`🏁 對局結束！<br>黑提子 ${game.captures[BLACK]} · 白提子 ${game.captures[WHITE]} (+6.5 貼目)<br>${bs>ws?'⚫ 黑棋領先':'⚪ 白棋領先'} ${Math.abs(bs-ws).toFixed(1)} 目（僅計算提子）`;
  }else{
    if(game.currentPlayer===BLACK)ind.classList.add('active-black');else ind.classList.add('active-white');
    const name=game.currentPlayer===BLACK?'⚫ 黑棋':'⚪ 白棋';
    let suf='';
    if(mode!=='hotseat'){
      suf=myColor===game.currentPlayer?' · 輪到你':' · 等待對手';
      if(myColor===game.currentPlayer)ind.classList.add('my-turn');
    }
    txt.textContent=name+suf;
  }
  $('passBtn').disabled=!canPlay();
}

function leaveGame(){
  if(transport){transport.close();transport=null;}
  if(peerInst){try{peerInst.destroy();}catch(e){}peerInst=null;}
  game=null;mode=null;
  gameScreen.classList.add('hidden');lobby.classList.remove('hidden');
  $('p2pHostPanel').classList.add('hidden');
  $('p2pJoinPanel').classList.add('hidden');
  $('p2pRoomCode').value='';
  $('p2pRoomInput').value='';
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
      addLog('✅ 對手已就緒，開始對弈','good');
      t.send({type:'helloAck',size:game?game.size:size});
    }else if(m.type==='helloAck'){
      otherReady=true;
      setConnStatus('連線成功','ok');
      addLog('✅ 連線成功！開始對弈','good');
    }else if(m.type==='move'){
      applyMoveRemote(m.result);
    }else if(m.type==='pass'){
      applyPassRemote(m.result);
    }else if(m.type==='newGame'){
      doNewGame();
    }
  };
  startGame('local',size,color);
  setConnStatus(isHost?'等待對手開啟另一分頁...':'嘗試連線房主...','warn');
  addLog(isHost?'請在同一瀏覽器開新分頁並點「加入對手分頁」':'正在與房主分頁連線...','system');
  t.send({type:'hello'});
  setTimeout(()=>{if(!otherReady){addLog('💡 提示：對手需在同瀏覽器新分頁中點擊「加入對手分頁」按鈕','system');}},1500);
}

/* ---------- PeerJS P2P (房間邀請碼) ---------- */
let peerInst=null, peerConn=null, p2pSize=19, p2pRole=null, peerLoaded=(typeof Peer!=='undefined');

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
      const code=$('p2pRoomCode').value;
      setP2PStatus('host','✅ 就緒！把邀請碼 '+code+' 分享給對手，等待他加入...','ok');
      addLog('邀請碼 '+code+' 已生效，等待對手加入','system');
    }
  });
  peerInst.on('connection',conn=>{
    if(peerConn){try{conn.close();}catch(e){}return;}
    peerConn=conn;
    conn.on('open',()=>peerDataReady(conn, role==='host'?BLACK:WHITE, size));
    conn.on('error',err=>addLog('P2P 錯誤：'+JSON.stringify(err),'error'));
  });
  peerInst.on('disconnected',()=>{
    if(!game){
      setP2PStatus(role,'⚠️ 與信令伺服器斷線，嘗試重新連線...','warn');
      setTimeout(()=>{try{peerInst&&peerInst.reconnect();}catch(e){}},1000);
    }
  });
  peerInst.on('error',err=>{
    const t=err&&err.type?err.type:'';
    const msg=err&&err.message?err.message:String(err);
    if(t==='unavailable-id'&&role==='host'){
      setP2PStatus('host','⚠️ 邀請碼撞名，重新產生中...','warn');
      setTimeout(()=>peerHostRoom(size),800);
    }else if(t==='peer-unavailable'){
      setP2PStatus('join','❌ 找不到此邀請碼的房主，請確認是否正確、或房主仍在線上','error');
    }else if(t==='network'||t==='disconnected'||msg.includes('network')){
      setP2PStatus(role,'⚠️ 網路不穩，請檢查連線後重整','warn');
    }else if(t==='invalid-id'||msg.includes('Invalid')){
      setP2PStatus(role,'❌ 邀請碼格式錯誤','error');
    }else{
      setP2PStatus(role,'❌ 錯誤：'+(t||msg),'error');
      addLog('Peer 錯誤：'+t+' '+msg,'error');
    }
  });
}

async function peerHostRoom(size){
  setP2PStatus('host','連接 PeerJS 信令伺服器中...','pending');
  if(peerInst){try{peerInst.destroy();}catch(e){}peerInst=null;}
  if(!peerLoaded){
    setP2PStatus('host','載入 PeerJS 模組中...','pending');
    const ok=await loadPeerJSFallback();
    if(!ok){setP2PStatus('host','❌ 無法載入 PeerJS（可能連線受限制），建議改用「分頁對弈」模式','error');return;}
  }
  const code=genRoomCode();
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
      $('p2pRoomCode').value=code;
      attachPeerHandlers(size,'host');
    }catch(e){
      if(tryCount++<2){setTimeout(make,500);}
      else setP2PStatus('host','❌ 建立失敗：'+e.message,'error');
    }
  };
  make();
}

async function peerJoinRoom(code){
  code=code.toUpperCase().trim();
  if(!/^[A-Z2-9]{4,8}$/.test(code)){
    setP2PStatus('join','❌ 邀請碼格式錯誤（應為 4~8 位英數字）','error');return;
  }
  setP2PStatus('join','🔗 正在連接房間 '+code+' ...','pending');
  if(peerInst){try{peerInst.destroy();}catch(e){}peerInst=null;}
  if(!peerLoaded){
    setP2PStatus('join','載入 PeerJS 模組中...','pending');
    const ok=await loadPeerJSFallback();
    if(!ok){setP2PStatus('join','❌ 無法載入 PeerJS（可能連線受限制），建議改用「分頁對弈」模式','error');return;}
  }
  const size=parseInt($('boardSize').value)||19;
  let timeout=setTimeout(()=>{
    if(!game)setP2PStatus('join','⏳ 連線逾時，請確認邀請碼正確且房主仍在等待','warn');
  },15000);
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
    setP2PStatus('join','❌ 建立 Peer 失敗：'+e.message,'error');return;
  }
  attachPeerHandlers(size,'join');
  peerInst.on('open',()=>{
    try{
      const c=peerInst.connect('GO-'+code,{reliable:true,serialization:'json'});
      peerConn=c;
      let opened=false;
      c.on('open',()=>{opened=true;clearTimeout(timeout);peerDataReady(c, WHITE, size);});
      c.on('error',err=>{clearTimeout(timeout);setP2PStatus('join','❌ 連線失敗：'+JSON.stringify(err),'error');});
      setTimeout(()=>{if(!opened&&!game){setP2PStatus('join','⏳ 對方未回應，確認房主是否仍在線','warn');}},10000);
    }catch(e){
      clearTimeout(timeout);
      setP2PStatus('join','❌ 連線失敗：'+e.message,'error');
    }
  });
}

function peerDataReady(conn, color, size){
  transport={
    send(msg){try{conn.send(JSON.stringify(msg));}catch(e){addLog('傳送失敗','error');}},
    close(){try{conn.close();}catch(e){}}
  };
  conn.on('data',raw=>{
    try{
      const m=typeof raw==='string'?JSON.parse(raw):raw;
      if(!m||!m.type)return;
      if(m.type==='move')applyMoveRemote(m.result);
      else if(m.type==='pass')applyPassRemote(m.result);
      else if(m.type==='newGame')doNewGame();
    }catch(e){
      addLog('收到異常資料：'+e.message,'error');
    }
  });
  conn.on('close',()=>{
    if(game){addLog('⚠️ 對手已離線或關閉連線','error');setConnStatus('對手離線','off');}
  });
  conn.on('error',err=>{addLog('連線錯誤：'+JSON.stringify(err),'error');});
  if(!game) startGame('p2p',size,color);
  setConnStatus('🟢 P2P 連線成功','ok');
  addLog('🌐 已建立 WebRTC 點對點連線，開始對弈！你是 '+(color===BLACK?'⚫ 黑棋 (先手)':'⚪ 白棋 (後手)'),'good');
}

function closeP2P(){
  if(peerConn){try{peerConn.close();}catch(e){}peerConn=null;}
  if(peerInst){try{peerInst.destroy();}catch(e){}peerInst=null;}
  p2pRole=null;
}

/* ---------- 自動偵測 URL 裡的 ?room= 參數 ---------- */
(function autoJoin(){
  if(document.readyState==='complete'||document.readyState==='interactive'){
    try{
      const params=new URLSearchParams(location.search);
      const r=params.get('room');
      if(r&&r.length>=4){
        setTimeout(()=>{
          $('p2pJoinPanel').classList.remove('hidden');
          $('p2pHostPanel').classList.add('hidden');
          $('p2pRoomInput').value=r.toUpperCase();
          setP2PStatus('join','偵測到邀請碼 '+r.toUpperCase()+'，自動連線中...','pending');
          addLog('🔍 偵測到連結邀請碼：'+r.toUpperCase()+'，正在自動加入','system');
          setTimeout(()=>peerJoinRoom(r),300);
        },200);
      }
    }catch(e){}
  }else{
    window.addEventListener('DOMContentLoaded',autoJoin,{once:true});
  }
})();

window.addEventListener('error',e=>{
  addLog('❌ 執行錯誤：'+(e&&e.message?e.message:String(e)),'error');
  console.error(e);
});

addLog('📡 系統就緒，請選擇對戰模式','system');
