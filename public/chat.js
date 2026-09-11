/* =========================================================
   對局聊天（模組）
   - 掛接 app.js 全域：peerConnections / peerConn / sendMessage /
     myColor / mode / BLACK / WHITE
   - 自行在 P2P 連線上額外註冊 'data' 監聽（PeerJS 支援多監聽器），
     使用獨立訊息類型 'chatMessage'，app.js 對未知類型本來就會忽略。
   - 單機雙人（hotseat）模式下，聊天欄做本機互動（雙方共用畫面）。
   - 連線建立時由 app.js 呼叫 GoChat.hookConn() 立即掛上監聽，
     並保留輪詢作後備，確保連線後最早的訊息不會漏接。
========================================================= */

(() => {
  'use strict';

  const QUICK_EMOJIS = ['👋', '👍', '🙏', '😂', '😮', '😢', '🤔', '🔥'];
  const GRID_EMOJIS = [
    '😀', '😄', '😂', '🤣', '😊', '😍', '😎', '🤔',
    '😅', '😮', '😱', '😢', '😭', '😡', '🤯', '🥳',
    '👍', '👎', '👏', '🙏', '🤝', '💪', '🫡', '🤌',
    '🔥', '⭐', '🎉', '💔', '🎯', '⚫', '⚪', '🏳️'
  ];

  const MAX_TEXT = 200;

  const $ = (id) => document.getElementById(id);

  let msgsEl = null;
  let unread = 0;
  let collapsed = false;

  /* ---------------- 模式 / 連線狀態 ---------------- */

  // 以 app.js 的全域 mode 為準，不依賴畫面文字（不受語言切換影響）
  function isHotseat() {
    try {
      if (typeof mode !== 'undefined' && mode) {
        return mode === 'hotseat';
      }
    } catch (e) {}
    const el = $('connMode');
    return !!(el && el.textContent && el.textContent.includes('單機'));
  }

  function hasOpenConn() {
    try {
      if (typeof peerConn !== 'undefined' && peerConn && peerConn.open) return true;
    } catch (e) {}
    try {
      if (typeof peerConnections !== 'undefined' && peerConnections) {
        for (const c of peerConnections) {
          if (c && c.open) return true;
        }
      }
    } catch (e) {}
    return false;
  }

  /* ---------------- 顯示名稱 ---------------- */

  function myLabel() {
    if (isHotseat()) return t('chat.player');
    try {
      if (typeof myColor !== 'undefined') {
        return myColor === BLACK ? t('chat.meBlack') : t('chat.meWhite');
      }
    } catch (e) {}
    return t('chat.me');
  }

  function oppLabel() {
    try {
      if (typeof myColor !== 'undefined') {
        return myColor === BLACK ? t('chat.oppWhite') : t('chat.oppBlack');
      }
    } catch (e) {}
    return t('chat.opp');
  }

  /* ---------------- 時間 ---------------- */

  function timeStr(ts) {
    const d = ts ? new Date(ts) : new Date();
    return d.toLocaleTimeString(
      (window.I18N && I18N.locale()) || 'zh-TW',
      { hour: '2-digit', minute: '2-digit' }
    );
  }

  /* ---------------- 訊息渲染 ---------------- */

  function isEmojiOnly(text) {
    const t = text.trim();
    if (!t || !/[^\u0000-\u007f]/.test(t)) return false;
    return /^[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{1F3FB}-\u{1F3FF}\s]+$/u.test(t);
  }

  function removeEmptyTip() {
    const tip = msgsEl.querySelector('.chat-empty');
    if (tip) tip.remove();
  }

  function scrollBottom() {
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  function bumpUnread() {
    if (!collapsed) return;
    unread++;
    const badge = $('chatUnread');
    badge.textContent = String(unread > 99 ? '99+' : unread);
    badge.classList.remove('hidden');
  }

  function appendBubble(side, text, ts, opts = {}) {
    removeEmptyTip();

    const line = document.createElement('div');
    line.className = 'chat-line ' + side;
    if (opts.failed) line.classList.add('failed');

    const emojiOnly = isEmojiOnly(text);
    if (emojiOnly) line.classList.add('emoji-only');

    const meta = document.createElement('div');
    meta.className = 'chat-meta';
    const who = document.createElement('span');
    who.textContent = opts.who;
    const when = document.createElement('span');
    when.textContent = timeStr(ts);
    meta.appendChild(who);
    meta.appendChild(when);

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    bubble.textContent = text;

    line.appendChild(meta);
    line.appendChild(bubble);
    msgsEl.appendChild(line);
    scrollBottom();

    if (side === 'opp') {
      // 收到對手訊息：提示音（收合時累計未讀）
      window.GoSound?.play('msg');
      bumpUnread();
    }
    return line;
  }

  function appendTip(text) {
    removeEmptyTip();
    const tip = document.createElement('div');
    tip.className = 'chat-line tip';
    tip.textContent = text;
    msgsEl.appendChild(tip);
    scrollBottom();
  }

  /* ---------------- 傳送 ---------------- */

  function sendRaw(msg) {
    // 優先用 app.js 的 sendMessage（自帶多連線容錯）
    try {
      if (typeof sendMessage === 'function') {
        return !!sendMessage(msg);
      }
    } catch (e) {}

    // 後備：直接對開啟中的連線發送
    try {
      if (typeof peerConn !== 'undefined' && peerConn && peerConn.open) {
        peerConn.send(JSON.stringify(msg));
        return true;
      }
    } catch (e) {}

    try {
      if (typeof peerConnections !== 'undefined' && peerConnections) {
        for (const c of peerConnections) {
          if (c && c.open) {
            try {
              c.send(JSON.stringify(msg));
              return true;
            } catch (e) {}
          }
        }
      }
    } catch (e) {}

    return false;
  }

  function sendChat(text) {
    text = String(text || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, MAX_TEXT);
    if (!text) return;

    const ts = Date.now();

    if (isHotseat()) {
      // 單機雙人：同畫面互動，本機顯示即可
      appendBubble('me', text, ts, { who: myLabel() });
      return;
    }

    const line = appendBubble('me', text, ts, { who: myLabel() });

    if (!hasOpenConn()) {
      line.classList.add('failed');
      appendTip(t('chat.notConnected'));
      return;
    }

    const ok = sendRaw({ type: 'chatMessage', text, ts });
    if (!ok) {
      line.classList.add('failed');
      appendTip(t('chat.sendFailed'));
    }
  }

  /* ---------------- 接收 ---------------- */

  function onRawData(raw) {
    let m;
    try {
      m = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (e) {
      return;
    }
    if (!m || m.type !== 'chatMessage') return;
    if (typeof m.text !== 'string') return;

    const text = m.text.slice(0, MAX_TEXT);
    appendBubble('opp', text, m.ts, { who: oppLabel() });
  }

  /* ---------------- 連線掛鉤 ---------------- */

  function hookConn(conn) {
    if (!conn || conn.__goChatHooked) return;
    conn.__goChatHooked = true;
    try {
      conn.on('data', onRawData);
    } catch (e) {}
  }

  // 供 app.js 在連線建立當下呼叫（連線開啟前掛好，最早訊息不漏接）
  window.GoChat = { hookConn };

  // 輪詢後備：攔截不經過 installConnHandlers 的連線
  function hookConnections() {
    try {
      if (typeof peerConnections === 'undefined' || !peerConnections) return;
      for (const c of peerConnections) {
        hookConn(c);
      }
    } catch (e) {}
  }

  /* ---------------- UI 建構 ---------------- */

  function buildQuickRow() {
    const row = $('chatQuick');
    for (const emo of QUICK_EMOJIS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = emo;
      b.title = t('chat.sendEmojiTitle', { e: emo });
      b.addEventListener('click', () => sendChat(emo));
      row.appendChild(b);
    }
  }

  function buildEmojiGrid() {
    const grid = $('chatEmojiGrid');
    for (const emo of GRID_EMOJIS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = emo;
      b.addEventListener('click', () => {
        grid.classList.add('hidden');
        sendChat(emo);
      });
      grid.appendChild(b);
    }
  }

  function toggleCollapse() {
    collapsed = !collapsed;
    const card = $('chatCard');
    const body = $('chatBody');
    const toggle = $('chatToggle');
    card.classList.toggle('collapsed', collapsed);
    body.style.display = collapsed ? 'none' : '';
    toggle.textContent = collapsed ? '▸' : '▾';
    if (!collapsed) {
      unread = 0;
      $('chatUnread').classList.add('hidden');
      scrollBottom();
    }
  }

  function init() {
    const card = $('chatCard');
    if (!card) return;

    msgsEl = $('chatMsgs');

    const empty = document.createElement('div');
    empty.className = 'chat-empty';
    empty.textContent = t('chat.empty');
    msgsEl.appendChild(empty);

    buildQuickRow();
    buildEmojiGrid();

    $('chatSendBtn').addEventListener('click', () => {
      const input = $('chatInput');
      sendChat(input.value);
      input.value = '';
      input.focus();
    });

    $('chatInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const input = $('chatInput');
        sendChat(input.value);
        input.value = '';
      }
    });

    $('chatEmojiBtn').addEventListener('click', () => {
      $('chatEmojiGrid').classList.toggle('hidden');
    });

    $('chatHead').addEventListener('click', toggleCollapse);

    // 語言切換時更新仍顯示中的空提示文字
    window.addEventListener('go:langchange', () => {
      if (!msgsEl) return;
      const tip = msgsEl.querySelector('.chat-empty');
      if (tip) tip.textContent = t('chat.empty');
    });

    setInterval(hookConnections, 800);
    hookConnections();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
