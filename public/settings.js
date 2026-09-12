/* =========================================================
   線上圍棋 — 設置模組
   - 偏好設定(主題 / 語言 / 音效)存於 localStorage 'goSettings.v1'
   - 主題:在 <html data-theme> 上切換,由 CSS 變數驅動
   - 語言:交給 I18N.setLang,並廣播 'go:langchange'
   - 提供設置面板 UI(右上角齒輪開啟)
========================================================= */

(() => {
  'use strict';

  const KEY = 'goSettings.v1';

  const DEFAULTS = {
    theme: 'light',
    lang: 'zh-TW',
    jukebox: false,
    skin: 'classic',
    fx: 'none',
    marker: 'ring',
    cap: 'none',
    sound: { on: true, volume: 0.7, stone: true, capture: true, msg: true }
  };

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
      return {
        ...DEFAULTS,
        ...raw,
        sound: { ...DEFAULTS.sound, ...(raw.sound || {}) }
      };
    } catch (e) {
      return JSON.parse(JSON.stringify(DEFAULTS));
    }
  }

  let settings = load();

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch (e) {}
  }

  function applyTheme() {
    document.documentElement.dataset.theme = settings.theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', settings.theme === 'dark' ? '#0f1115' : '#f5f6f8');
    }
  }

  /* 唱片機:默認關閉且不可見,設置裡開啟後全域可見 */
  function applyJukebox() {
    const btn = document.getElementById('jukeboxBtn');
    if (!btn) return;
    btn.classList.toggle('hidden', !settings.jukebox);
    if (!settings.jukebox) {
      document.getElementById('jukeboxPanel')?.classList.remove('open');
    }
  }

  window.GoSettings = {
    get: () => settings,
    set(patch) {
      let themeChanged = false;
      let langChanged = false;
      let jukeboxChanged = false;
      let skinChanged = false;

      if (patch.theme && patch.theme !== settings.theme) {
        settings.theme = patch.theme;
        themeChanged = true;
      }
      if (patch.lang && patch.lang !== settings.lang) {
        settings.lang = patch.lang;
        langChanged = true;
      }
      if (
        patch.jukebox !== undefined &&
        !!patch.jukebox !== !!settings.jukebox
      ) {
        settings.jukebox = !!patch.jukebox;
        jukeboxChanged = true;
      }
      if (
        patch.skin &&
        patch.skin !== settings.skin
      ) {
        settings.skin = patch.skin;
        skinChanged = true;
      }
      if (
        patch.fx &&
        patch.fx !== settings.fx
      ) {
        settings.fx = patch.fx;
      }
      if (
        patch.marker &&
        patch.marker !== settings.marker
      ) {
        settings.marker = patch.marker;
      }
      if (
        patch.cap &&
        patch.cap !== settings.cap
      ) {
        settings.cap = patch.cap;
      }
      if (patch.sound) {
        settings.sound = { ...settings.sound, ...patch.sound };
      }

      save();
      if (themeChanged) applyTheme();
      if (jukeboxChanged) applyJukebox();
      if (skinChanged) {
        window.dispatchEvent(new CustomEvent('go:skinchange'));
      }
      if (langChanged && window.I18N) window.I18N.setLang(settings.lang);
    }
  };

  applyTheme();
  applyJukebox();

  /* ---------------- 設置面板 ---------------- */

  const $ = (id) => document.getElementById(id);

  function openPanel() {
    syncUI();
    $('settingsOverlay')?.classList.remove('hidden');
  }

  function closePanel() {
    $('settingsOverlay')?.classList.add('hidden');
  }

  function setSegmentChecked(groupSel, value) {
    document
      .querySelectorAll(groupSel + ' button')
      .forEach(b => b.classList.toggle('checked', b.dataset.value === value));
  }

  function syncUI() {
    setSegmentChecked('#themeSeg', settings.theme);
    setSegmentChecked('#langSeg', settings.lang);

    if ($('sndOn')) $('sndOn').checked = !!settings.sound.on;
    if ($('sndVol')) $('sndVol').value = String(Math.round(settings.sound.volume * 100));
    if ($('sndStone')) $('sndStone').checked = settings.sound.stone !== false;
    if ($('sndCapture')) $('sndCapture').checked = settings.sound.capture !== false;
    if ($('sndMsg')) $('sndMsg').checked = settings.sound.msg !== false;
    if ($('jbOn')) $('jbOn').checked = !!settings.jukebox;

    const detail = $('soundDetail');
    if (detail) detail.classList.toggle('disabled', !settings.sound.on);
  }

  function wire() {
    if (!$('settingsOverlay')) return;

    $('settingsBtn')?.addEventListener('click', openPanel);
    $('settingsClose')?.addEventListener('click', closePanel);

    $('settingsOverlay').addEventListener('click', e => {
      if (e.target === e.currentTarget) closePanel();
    });

    document.addEventListener('keydown', e => {
      if (
        e.key === 'Escape' &&
        $('settingsOverlay') &&
        !$('settingsOverlay').classList.contains('hidden')
      ) {
        closePanel();
      }
    });

    document.querySelectorAll('#themeSeg button').forEach(b => {
      b.addEventListener('click', () => {
        window.GoSettings.set({ theme: b.dataset.value });
        setSegmentChecked('#themeSeg', b.dataset.value);
      });
    });

    document.querySelectorAll('#langSeg button').forEach(b => {
      b.addEventListener('click', () => {
        window.GoSettings.set({ lang: b.dataset.value });
        setSegmentChecked('#langSeg', b.dataset.value);
      });
    });

    $('sndOn')?.addEventListener('change', e => {
      window.GoSettings.set({ sound: { on: e.target.checked } });
      const detail = $('soundDetail');
      if (detail) detail.classList.toggle('disabled', !e.target.checked);
    });

    $('sndVol')?.addEventListener('input', e => {
      window.GoSettings.set({ sound: { volume: Number(e.target.value) / 100 } });
    });

    $('sndStone')?.addEventListener('change', e => {
      window.GoSettings.set({ sound: { stone: e.target.checked } });
      if (e.target.checked) window.GoSound?.play('stone');
    });

    $('sndCapture')?.addEventListener('change', e => {
      window.GoSettings.set({ sound: { capture: e.target.checked } });
      if (e.target.checked) window.GoSound?.play('capture');
    });

    $('sndMsg')?.addEventListener('change', e => {
      window.GoSettings.set({ sound: { msg: e.target.checked } });
      if (e.target.checked) window.GoSound?.play('msg');
    });

    $('jbOn')?.addEventListener('change', e => {
      window.GoSettings.set({ jukebox: e.target.checked });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();
