/* =========================================================
   線上圍棋 — 音效模組
   - 使用 Web Audio API 即時合成,不需外部音檔
   - 落子:短促的木石敲擊聲 / 提子:雙擊掃頻 / 訊息:柔和雙音
   - 依 GoSettings 的開關與音量播放;瀏覽器政策下
     在第一次使用者手勢時解鎖 AudioContext
========================================================= */

(() => {
  'use strict';

  let ctx = null;

  function ac() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try {
        ctx = new AC();
      } catch (e) {
        return null;
      }
    }
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  // AudioContext 需要使用者手勢才能啟動
  document.addEventListener('pointerdown', () => ac(), { once: true, capture: true });

  function cfg() {
    const s = window.GoSettings && window.GoSettings.get ? window.GoSettings.get() : null;
    return (s && s.sound) || { on: true, volume: 0.7, stone: true, capture: true, msg: true };
  }

  function vol() {
    const s = cfg();
    const v = typeof s.volume === 'number' ? s.volume : 0.7;
    return Math.max(0, Math.min(1, v));
  }

  /* 單音:振盪器 + 指數衰減包絡 */
  function tone(c, { freq, when, dur = 0.1, type = 'sine', peak = 0.4, slide = 0 }) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    if (slide) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), when + dur);
    }
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(peak * vol(), when + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(g).connect(c.destination);
    osc.start(when);
    osc.stop(when + dur + 0.02);
  }

  /* 噪音爆發:帶通濾波,模擬敲擊質感 */
  function knock(c, { when, dur = 0.04, freq = 2500, q = 1, peak = 0.3 }) {
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    const src = c.createBufferSource();
    src.buffer = buf;
    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = c.createGain();
    g.gain.value = peak * vol();
    src.connect(filter).connect(g).connect(c.destination);
    src.start(when);
  }

  const sounds = {

    /* 落子:低頻悶響 + 高頻清脆敲擊(棋子落在木板上的「啪」) */
    stone() {
      const c = ac();
      if (!c) return;
      const now = c.currentTime;
      tone(c, { freq: 170, slide: -60, dur: 0.09, type: 'sine', peak: 0.5, when: now });
      knock(c, { dur: 0.03, freq: 3400, q: 0.8, peak: 0.35, when: now });
      tone(c, { freq: 2300, dur: 0.03, type: 'triangle', peak: 0.1, when: now });
    },

    /* 提子:掃頻下滑的柔和噪音 + 短雙擊 */
    capture() {
      const c = ac();
      if (!c) return;
      const now = c.currentTime;
      knock(c, { dur: 0.08, freq: 1700, q: 1.2, peak: 0.28, when: now });
      tone(c, { freq: 520, slide: -200, dur: 0.14, type: 'triangle', peak: 0.2, when: now + 0.02 });
    },

    /* 新訊息:上行雙音提示 */
    msg() {
      const c = ac();
      if (!c) return;
      const now = c.currentTime;
      tone(c, { freq: 880, dur: 0.12, type: 'sine', peak: 0.16, when: now });
      tone(c, { freq: 1318, dur: 0.16, type: 'sine', peak: 0.12, when: now + 0.09 });
    }
  };

  function play(name) {
    const s = cfg();
    if (!s.on) return;
    if (s[name] === false) return;
    try {
      if (sounds[name]) sounds[name]();
    } catch (e) {}
  }

  window.GoSound = { play };
})();
