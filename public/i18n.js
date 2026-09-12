/* =========================================================
   線上圍棋 — 多語系模組
   - 預設語言:繁體中文 (zh-TW),可切換 English
   - 靜態文字:HTML 上標 data-i18n / data-i18n-placeholder / data-i18n-title
   - 動態文字:JS 內呼叫 t('key', {params})
   - 初始語言從 localStorage 的設置(goSettings.v1)讀取
========================================================= */

(() => {
  'use strict';

  const DICT = {
    'zh-TW': {
      'app.title': '線上圍棋',
      'app.tagline': '對弈 · 連線 · 手談',

      'mode.title': '對戰模式',
      'mode.local': '單機雙人',
      'mode.localDesc': '同一畫面兩人輪流',
      'mode.host': '建立房間',
      'mode.hostDesc': '產生邀請碼',
      'mode.join': '加入房間',
      'mode.joinDesc': '輸入邀請碼',

      'size.title': '棋盤大小',
      'size.beginner': '入門',
      'size.intermediate': '中級',
      'size.standard': '標準',

      'resume.title': '恢復對局',
      'resume.continue': '繼續上一局',
      'resume.clear': '清除記錄',

      'host.title': '等待對手加入',
      'host.codeLabel': '邀請碼',
      'host.copy': '複製',
      'host.share': '分享連結',
      'host.connecting': '連線中...',
      'join.title': '加入房間',
      'join.codeLabel': '輸入邀請碼',
      'join.placeholder': '例如：G7XK2M',
      'join.submit': '加入',
      'join.waiting': '等待輸入邀請碼',
      'join.spectate': '觀戰加入',

      'modal.confirmTitle': '確認',
      'modal.confirmBody': '是否執行此操作？',
      'modal.cancel': '取消',
      'modal.ok': '確定',

      'game.mode': '模式',
      'game.modeLocal': '單機',
      'game.modeP2p': 'P2P 線上',
      'game.modeSpectate': '觀戰',
      'game.you': '你是',
      'game.status': '狀態',

      'player.black': '黑棋',
      'player.white': '白棋',
      'player.ready': '已就緒',
      'player.captures': '提子',
      'turn.blackFirst': '黑棋先行',
      'turn.onePass': '（再虛手一次即終局）',
      'turn.spectating': '（觀戰中）',
      'log.pass': '{p}虛手',
      'color.black': '黑',
      'color.white': '白',

      'act.pass': '虛手 Pass',
      'act.undo': '悔棋',
      'act.newGame': '新對局',
      'act.leave': '返回大廳',

      'chat.title': '對局聊天',
      'chat.placeholder': '輸入訊息…',
      'chat.send': '傳送',
      'chat.emoji': '表情',

      'settings.title': '設置',
      'settings.theme': '主題',
      'settings.light': '淺色',
      'settings.dark': '深色',
      'settings.lang': '語言',
      'settings.sound': '音效',
      'settings.volume': '音量',
      'settings.jukebox': '唱片機',
      'settings.skin': '皮膚',
      'skin.classic': '經典',
      'skin.pig': '小豬',
      'skin.shiba': '柴犬',
      'skin.cat': '貓咪',
      'skin.panda': '貓熊',
      'skin.galaxy': '星空',
      'skin.math': '數學',

      'wardrobe.title': '衣櫥',
      'wardrobe.stones': '棋子皮膚',
      'wardrobe.fx': '落子特效',
      'wardrobe.cap': '提子特效',
      'wardrobe.last': '最後一手',
      'wardrobe.boards': '棋盤皮膚',
      'wardrobe.boardSoon': '棋盤皮膚敬請期待',
      'wardrobe.boardSoonSub': '木紋、石盤、星空棋盤主題製作中',
      'mk.ring': '紅圈',
      'mk.ringDesc': '傳統紅圈標記最後一手',
      'mk.pulse': '呼吸光暈',
      'mk.pulseDesc': '柔光隨呼吸明滅',
      'mk.blink': '閃爍提醒',
      'mk.blinkDesc': '標記閃爍,引人注意',
      'mk.spin': '迴旋光環',
      'mk.spinDesc': '光弧繞著棋子旋轉',
      'mk.stars': '星辰環繞',
      'mk.starsDesc': '小星星繞著棋子閃爍旋轉',
      'mk.planet': '行星公轉',
      'mk.planetDesc': '行星沿軌道繞棋子運行',
      'mk.tornado': '龍捲風',
      'mk.tornadoDesc': '龍捲風以棋子為中心盤旋',
      'cap.none': '無',
      'cap.noneDesc': '提子時不播放特效',
      'cap.boom': '爆炸烈焰',
      'cap.boomDesc': '提子處烈焰爆發,火星四濺',
      'cap.shatter': '碎裂飛散',
      'cap.shatterDesc': '棋子碎裂成碎片飛散',
      'cap.ash': '灰飛煙滅',
      'cap.ashDesc': '棋子化為灰煙消散',
      'cap.dust': '星塵四散',
      'cap.dustDesc': '棋子化作星塵閃爍四散',
      'records.title': '戰績',
      'records.sub': '最近十場完整對局 · 中途退出不計',
      'records.open': '戰績回顧',
      'records.openHint': '最近十場完整對局 · 可回放',
      'records.empty': '尚無完整對局紀錄',
      'records.emptySub': '完成一場對局後就會記錄在這裡',
      'records.replay': '回放',
      'records.youWin': '你勝 {d} 目',
      'records.youLose': '對手勝 {d} 目',
      'records.movesUnit': '手',
      'records.modeLocal': '單機雙人',
      'replay.mode': '回放模式',
      'replay.exit': '離開回放',
      'replay.play': '播放',
      'replay.pause': '暫停',
      'fx.none': '無',
      'fx.noneDesc': '保持棋盤原貌,不播放特效',
      'fx.qi': '氣勢如虹',
      'fx.qiDesc': '落子後白氣自棋子迸發而出',
      'fx.math': '神機妙算',
      'fx.mathDesc': '積分、求和等數學符號自棋子飄然而上',
      'fx.spark': '星火燎原',
      'fx.sparkDesc': '金色火星自落子處迸射',
      'fx.ripple': '漣漪陣陣',
      'fx.rippleDesc': '石落水面,漣漪層層蕩開',
      'fx.petal': '落櫻繽紛',
      'fx.petalDesc': '櫻花花瓣繚繞飄落',
      'fx.bolt': '雷霆萬鈞',
      'fx.boltDesc': '雷光乍現,電弧纏繞棋子',
      'sound.stone': '落子音',
      'sound.capture': '提子音',
      'sound.msg': '訊息音',

      'err.over': '遊戲已結束',
      'err.bounds': '超出邊界',
      'err.occupied': '此位置已有棋子',
      'err.ko': '打劫禁止',
      'err.suicide': '禁止自殺',
      'err.superko': '打劫禁止重複局面',
      'err.noUndo': '無棋可悔',

      'dyn.copied': '已複製！',
      'dyn.invalidCode': '請輸入有效的邀請碼',
      'dyn.roleShared': '雙人共用',
      'dyn.roleBlack': '黑棋',
      'dyn.roleWhite': '白棋',
      'dyn.start': '對局開始！',
      'dyn.confirmNewTitle': '確認新對局',
      'dyn.confirmNewBody': '確定要開始新對局嗎？',
      'dyn.undoPending': '已有等待中的悔棋請求',
      'dyn.undoOwnOnly': '只能悔自己落下的最後一手棋',
      'dyn.undoNoConn': '目前無法連接對手',
      'dyn.undoSent': '已送出悔棋請求，等待對方同意...',
      'dyn.undoReqTitle': '悔棋請求',
      'dyn.undoReqBody': '對手請求悔棋，是否同意？',
      'dyn.undoAgreedLog': '已同意對手悔棋，棋盤已更新，輪到對方落子',
      'dyn.undoAccepted': '對方已同意悔棋！目前輪到你落子',
      'dyn.undoRejected': '對方拒絕了你的悔棋請求',
      'dyn.turnYou': '（輪到你）',
      'dyn.turnWait': '（等待對手）',
      'dyn.gameOver': '對局結束！{w}勝 {d} 目',

      'scoring.hint': '終局！如需標記死子，點擊棋子即可，比分會即時更新',
      'result.title': '對局結果',
      'result.body': '{w}勝 {d} 目（黑 {b} — 白 {c}）',

      'net.fail': '連線失敗',
      'net.failLog': '多次重新連線失敗，請確認雙方網路狀態。',
      'net.reconnecting': '正在重連 ({n}/10)',
      'net.connected': '已連線',
      'net.waitOpponent': '等待對手重新連線...',
      'net.oppLeft': '對手已離開',
      'net.oppLeftLog': '對手已主動離開房間',
      'net.synced': '棋盤狀態已同步',
      'net.disconnected': '連線中斷，正在重連...',
      'net.interrupted': '網路連線暫時中斷，正在嘗試重新連線...',
      'net.peerFail': 'PeerJS 載入失敗',
      'net.roomCreated': '房間已建立！邀請碼：{c}，請等待對手加入...',
      'net.oppConnected': '對手已連線',
      'net.oppJoined': '對手已成功加入，開始對局！',
      'net.recovering': 'P2P 暫時斷線，正在恢復...',
      'net.rebuilding': 'P2P 服務暫時中斷，正在重新連線...',
      'net.netErr': '網路異常',
      'net.sendFailed': '訊息未送出，連線可能已中斷',
      'net.joining': '正在加入房間 {c} ...',
      'net.joined': '已加入房間',
      'net.joinedSync': '已順利連入房間！等待同步棋盤...',
      'net.spectating': '以觀戰身分加入 {c} ...',
      'net.spectateSync': '已加入觀戰！同步棋盤中...',
      'log.spectateJoined': '{n} 加入觀戰',
      'log.spectateLeft': '{n} 離開觀戰',

      'chat.me': '我',
      'chat.opp': '對手',
      'chat.spectator': '觀棋者',
      'chat.nameLabel': '你的稱呼',
      'chat.meBlack': '我（黑棋）',
      'chat.meWhite': '我（白棋）',
      'chat.oppBlack': '對手（黑棋）',
      'chat.oppWhite': '對手（白棋）',
      'chat.player': '棋手',
      'chat.empty': '💬 和對手打聲招呼吧！\n輸入文字或點選表情',
      'chat.sendEmojiTitle': '傳送表情 {e}',
      'chat.notConnected': '尚未與對手連線，訊息未送出',
      'chat.sendFailed': '訊息傳送失敗，請檢查連線',

      'jb.title': '唱片機',
      'jb.pickFiles': '選擇檔案',
      'jb.pickFolder': '選擇資料夾',
      'jb.clear': '清空',
      'jb.empty': '選擇裝置裡的 MP4 / MP3 開始播放\n支援一次加入多個檔案',
      'jb.noMp4': '選的檔案／資料夾裡沒有 MP4 或 MP3',
      'jb.repeatAll': '全部循環',
      'jb.repeatOne': '單曲循環',
      'jb.play': '播放',
      'jb.pause': '暫停',
      'jb.prev': '上一首',
      'jb.next': '下一首',
      'jb.volume': '音量'
    },

    'en': {
      'app.title': 'Online Go',
      'app.tagline': 'Play · Connect · Chat',

      'mode.title': 'Game Mode',
      'mode.local': 'Local 2P',
      'mode.localDesc': 'Two players on one screen',
      'mode.host': 'Create Room',
      'mode.hostDesc': 'Generate an invite code',
      'mode.join': 'Join Room',
      'mode.joinDesc': 'Enter an invite code',

      'size.title': 'Board Size',
      'size.beginner': 'Beginner',
      'size.intermediate': 'Intermediate',
      'size.standard': 'Standard',

      'resume.title': 'Resume Game',
      'resume.continue': 'Continue last game',
      'resume.clear': 'Clear record',

      'host.title': 'Waiting for opponent',
      'host.codeLabel': 'Invite Code',
      'host.copy': 'Copy',
      'host.share': 'Share link',
      'host.connecting': 'Connecting...',
      'join.title': 'Join Room',
      'join.codeLabel': 'Enter invite code',
      'join.placeholder': 'e.g. G7XK2M',
      'join.submit': 'Join',
      'join.waiting': 'Waiting for invite code',
      'join.spectate': 'Spectate',

      'modal.confirmTitle': 'Confirm',
      'modal.confirmBody': 'Perform this action?',
      'modal.cancel': 'Cancel',
      'modal.ok': 'OK',

      'game.mode': 'Mode',
      'game.modeLocal': 'Local',
      'game.modeP2p': 'P2P Online',
      'game.modeSpectate': 'Spectating',
      'game.you': 'You are',
      'game.status': 'Status',

      'player.black': 'Black',
      'player.white': 'White',
      'player.ready': 'Ready',
      'player.captures': 'Captures',
      'turn.blackFirst': 'Black plays first',
      'turn.onePass': ' — one more pass ends the game',
      'turn.spectating': ' (spectating)',
      'log.pass': '{p} passed',
      'color.black': 'Black',
      'color.white': 'White',

      'act.pass': 'Pass',
      'act.undo': 'Undo',
      'act.newGame': 'New Game',
      'act.leave': 'Leave',

      'chat.title': 'Game Chat',
      'chat.placeholder': 'Type a message…',
      'chat.send': 'Send',
      'chat.emoji': 'Emoji',

      'settings.title': 'Settings',
      'settings.theme': 'Theme',
      'settings.light': 'Light',
      'settings.dark': 'Dark',
      'settings.lang': 'Language',
      'settings.sound': 'Sound',
      'settings.volume': 'Volume',
      'settings.jukebox': 'Jukebox',
      'settings.skin': 'Stone Skin',
      'skin.classic': 'Classic',
      'skin.pig': 'Piggy',
      'skin.shiba': 'Shiba',
      'skin.cat': 'Cat',
      'skin.panda': 'Panda',
      'skin.galaxy': 'Galaxy',
      'skin.math': 'Math',

      'wardrobe.title': 'Wardrobe',
      'wardrobe.stones': 'Stone Skins',
      'wardrobe.fx': 'Stone Effects',
      'wardrobe.cap': 'Captures',
      'wardrobe.last': 'Last Move',
      'wardrobe.boards': 'Board Skins',
      'wardrobe.boardSoon': 'Board skins coming soon',
      'wardrobe.boardSoonSub': 'Wood, stone and galaxy board themes in the works',
      'mk.ring': 'Red Ring',
      'mk.ringDesc': 'Classic red ring marks the last move',
      'mk.pulse': 'Pulsing Glow',
      'mk.pulseDesc': 'A soft glow breathes around the stone',
      'mk.blink': 'Blink',
      'mk.blinkDesc': 'The marker blinks for attention',
      'mk.spin': 'Spinning Halo',
      'mk.spinDesc': 'An arc of light orbits the stone',
      'mk.stars': 'Star Orbit',
      'mk.starsDesc': 'Twinkling stars circle the stone',
      'mk.planet': 'Planet Orbit',
      'mk.planetDesc': 'Planets orbit the stone on their paths',
      'mk.tornado': 'Tornado',
      'mk.tornadoDesc': 'A vortex swirls around the stone',
      'cap.none': 'None',
      'cap.noneDesc': 'No capture effects',
      'cap.boom': 'Explosion',
      'cap.boomDesc': 'A fiery blast erupts where stones are captured',
      'cap.shatter': 'Shatter',
      'cap.shatterDesc': 'The stone shatters into flying shards',
      'cap.ash': 'Ash Cloud',
      'cap.ashDesc': 'The stone dissolves into drifting ash',
      'cap.dust': 'Stardust',
      'cap.dustDesc': 'The stone bursts into twinkling stardust',
      'records.title': 'Records',
      'records.sub': 'The last 10 full games · abandoned games are not counted',
      'records.open': 'Game Records',
      'records.openHint': 'Last 10 full games · replayable',
      'records.empty': 'No finished games yet',
      'records.emptySub': 'Finish a game and it will show up here',
      'records.replay': 'Replay',
      'records.youWin': 'You win by {d}',
      'records.youLose': 'Opponent wins by {d}',
      'records.movesUnit': ' moves',
      'records.modeLocal': 'Local 2P',
      'replay.mode': 'Replay',
      'replay.exit': 'Exit Replay',
      'replay.play': 'Play',
      'replay.pause': 'Pause',
      'fx.none': 'None',
      'fx.noneDesc': 'Keep the board plain, no effects',
      'fx.qi': 'Qi Burst',
      'fx.qiDesc': 'White qi erupts from the placed stone',
      'fx.math': 'Math Wonders',
      'fx.mathDesc': 'Integrals and math symbols float up from the stone',
      'fx.spark': 'Spark Burst',
      'fx.sparkDesc': 'Golden sparks burst from the stone',
      'fx.ripple': 'Ripples',
      'fx.rippleDesc': 'Ripples spread out from the stone',
      'fx.petal': 'Sakura Fall',
      'fx.petalDesc': 'Sakura petals drift down around the stone',
      'fx.bolt': 'Thunderclap',
      'fx.boltDesc': 'Lightning arcs crackle around the stone',
      'sound.stone': 'Stone',
      'sound.capture': 'Capture',
      'sound.msg': 'Message',

      'err.over': 'Game is over',
      'err.bounds': 'Out of bounds',
      'err.occupied': 'Point already occupied',
      'err.ko': 'Ko rule: move forbidden',
      'err.suicide': 'Suicide moves are forbidden',
      'err.superko': 'Ko rule: board repetition',
      'err.noUndo': 'Nothing to undo',

      'dyn.copied': 'Copied!',
      'dyn.invalidCode': 'Please enter a valid invite code',
      'dyn.roleShared': 'Shared',
      'dyn.roleBlack': 'Black',
      'dyn.roleWhite': 'White',
      'dyn.start': 'Game started!',
      'dyn.confirmNewTitle': 'New Game',
      'dyn.confirmNewBody': 'Start a new game? Current progress will be lost.',
      'dyn.undoPending': 'An undo request is already pending',
      'dyn.undoOwnOnly': 'You can only undo your own last move',
      'dyn.undoNoConn': 'Cannot reach the opponent right now',
      'dyn.undoSent': 'Undo request sent, waiting for approval...',
      'dyn.undoReqTitle': 'Undo Request',
      'dyn.undoReqBody': 'Opponent requests an undo. Accept?',
      'dyn.undoAgreedLog': 'Undo approved. Board updated — opponent\'s turn',
      'dyn.undoAccepted': 'Opponent approved the undo! It\'s your turn',
      'dyn.undoRejected': 'Opponent rejected your undo request',
      'dyn.turnYou': ' — your turn',
      'dyn.turnWait': ' — waiting for opponent',
      'dyn.gameOver': 'Game over! {w} wins by {d} points',

      'scoring.hint': 'Game over! Tap a group to toggle dead stones — the score updates live',
      'result.title': 'Game Result',
      'result.body': '{w} wins by {d} points (Black {b} — White {c})',

      'net.fail': 'Connection failed',
      'net.failLog': 'Reconnection failed repeatedly. Please check both networks.',
      'net.reconnecting': 'Reconnecting ({n}/10)',
      'net.connected': 'Connected',
      'net.waitOpponent': 'Waiting for opponent to reconnect...',
      'net.oppLeft': 'Opponent left',
      'net.oppLeftLog': 'Opponent left the room',
      'net.synced': 'Board state synced',
      'net.disconnected': 'Disconnected, reconnecting...',
      'net.interrupted': 'Connection interrupted, trying to reconnect...',
      'net.peerFail': 'Failed to load PeerJS',
      'net.roomCreated': 'Room created! Invite code: {c} — waiting for opponent...',
      'net.oppConnected': 'Opponent connected',
      'net.oppJoined': 'Opponent joined. Game on!',
      'net.recovering': 'P2P temporarily lost, recovering...',
      'net.rebuilding': 'P2P service interrupted, reconnecting...',
      'net.netErr': 'Network error',
      'net.sendFailed': 'Message not sent — connection may be down',
      'net.joining': 'Joining room {c} ...',
      'net.joined': 'Joined room',
      'net.joinedSync': 'Joined the room! Waiting for board sync...',
      'net.spectating': 'Joining {c} as spectator ...',
      'net.spectateSync': 'Spectating! Syncing the board...',
      'log.spectateJoined': '{n} started spectating',
      'log.spectateLeft': '{n} stopped spectating',

      'chat.me': 'Me',
      'chat.opp': 'Opponent',
      'chat.spectator': 'Spectator',
      'chat.nameLabel': 'Your name',
      'chat.meBlack': 'Me (Black)',
      'chat.meWhite': 'Me (White)',
      'chat.oppBlack': 'Opponent (Black)',
      'chat.oppWhite': 'Opponent (White)',
      'chat.player': 'Player',
      'chat.empty': '💬 Say hello to your opponent!\nType a message or tap an emoji',
      'chat.sendEmojiTitle': 'Send {e}',
      'chat.notConnected': 'Not connected — message not sent',
      'chat.sendFailed': 'Failed to send. Check your connection.',

      'jb.title': 'Jukebox',
      'jb.pickFiles': 'Choose files',
      'jb.pickFolder': 'Choose folder',
      'jb.clear': 'Clear',
      'jb.empty': 'Pick MP4 or MP3 files from your device to start\nAdd as many as you like',
      'jb.noMp4': 'No MP4 or MP3 files found in that selection',
      'jb.repeatAll': 'Repeat all',
      'jb.repeatOne': 'Repeat one',
      'jb.play': 'Play',
      'jb.pause': 'Pause',
      'jb.prev': 'Previous',
      'jb.next': 'Next',
      'jb.volume': 'Volume'
    }
  };

  let current = 'zh-TW';

  // 初始語言:從設置儲存(goSettings.v1)讀取
  try {
    const s = JSON.parse(localStorage.getItem('goSettings.v1') || 'null');
    if (s && DICT[s.lang]) current = s.lang;
  } catch (e) {}

  /* 反查表:由譯文找回詞條 key,
     供動態狀態文字在語言切換時重繪 */
  const REVERSE = {};
  for (const lang of Object.keys(DICT)) {
    for (const k of Object.keys(DICT[lang])) {
      const v = DICT[lang][k];
      if (!(v in REVERSE)) REVERSE[v] = k;
    }
  }

  function keyOf(text) {
    return (text != null && REVERSE[text]) || null;
  }

  function t(key, params) {
    let s = DICT[current][key];
    if (s == null) s = DICT['zh-TW'][key];
    if (s == null) return key;
    if (params) {
      s = s.replace(/\{(\w+)\}/g, (m, k) => (params[k] != null ? String(params[k]) : m));
    }
    return s;
  }

  function apply(root = document) {
    root.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = t(el.dataset.i18n);
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.placeholder = t(el.dataset.i18nPlaceholder);
    });
    root.querySelectorAll('[data-i18n-title]').forEach(el => {
      el.title = t(el.dataset.i18nTitle);
    });
  }

  function setLang(lang) {
    if (!DICT[lang]) lang = 'zh-TW';
    current = lang;
    document.documentElement.dataset.lang = lang;
    document.documentElement.lang = (lang === 'en' ? 'en' : 'zh-TW');
    document.title = t('app.title');
    apply();
    window.dispatchEvent(new CustomEvent('go:langchange'));
  }

  // 啟動:套用初始語言
  document.documentElement.dataset.lang = current;
  document.documentElement.lang = (current === 'en' ? 'en' : 'zh-TW');

  window.t = t;
  window.I18N = {
    t,
    apply,
    setLang,
    keyOf,
    lang: () => current,
    locale: () => (current === 'en' ? 'en-US' : 'zh-TW')
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      document.title = t('app.title');
      apply();
    });
  } else {
    document.title = t('app.title');
    apply();
  }
})();
