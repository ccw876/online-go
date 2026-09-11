/* =========================================================
   線上圍棋 — 唱片機模組
   - 從裝置挑選 MP4(單檔或整個資料夾)加入播放清單
   - 循環播放:全部循環 / 單曲循環
   - 播放時唱片旋轉、唱臂落下;面板關閉仍繼續播放
   - 音量與循環模式存在 localStorage 'goJukebox.v1'
========================================================= */

(() => {
  'use strict';

  const PREFS_KEY = 'goJukebox.v1';
  const MEDIA_RE = /\.mp4$/i;

  const $ = (id) => document.getElementById(id);

  let video = null;
  let playlist = [];   // { name, url }
  let index = -1;
  let errStreak = 0;
  let flashTimer = null;

  let prefs = { volume: 0.8, repeat: 'all' };
  try {
    prefs = { ...prefs, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') };
  } catch (e) {}

  function savePrefs() {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch (e) {}
  }

  /* ---------------- 播放引擎 ---------------- */

  function ensureVideo() {
    if (video) return;
    video = document.createElement('video');
    video.setAttribute('playsinline', '');
    // 放在可視區外(而非 display:none),確保背景音訊不被瀏覽器節流
    video.style.cssText =
      'position:fixed;left:-9999px;top:0;width:2px;height:2px;opacity:0;pointer-events:none;';
    video.volume = prefs.volume;
    video.addEventListener('ended', onEnded);
    video.addEventListener('error', onError);
    video.addEventListener('play', () => setPlayingUI(true));
    video.addEventListener('pause', () => setPlayingUI(false));
    document.body.appendChild(video);
  }

  function onEnded() {
    errStreak = 0;
    if (prefs.repeat === 'one') {
      video.currentTime = 0;
      video.play().catch(() => {});
      return;
    }
    step(1, true);
  }

  function onError() {
    if (index < 0 || !playlist.length) return;

    // 檔案無法解碼:跳下一首;全部都失敗才停下來
    errStreak++;
    if (errStreak >= playlist.length) {
      errStreak = 0;
      pause();
      return;
    }
    setTimeout(() => step(1, true), 600);
  }

  function step(delta, autoplay) {
    if (!playlist.length) return;
    const i = (index + delta + playlist.length) % playlist.length;
    loadTrack(i, autoplay);
  }

  function loadTrack(i, autoplay) {
    ensureVideo();
    index = i;
    errStreak = 0;
    video.src = playlist[i].url;
    renderList();
    updateInfo();
    if (autoplay) {
      play();
    } else {
      setPlayingUI(false);
    }
  }

  function play() {
    ensureVideo();
    if (!playlist.length) return;
    if (index < 0) {
      loadTrack(0, true);
      return;
    }
    video.volume = prefs.volume;
    video.play().catch(() => setPlayingUI(false));
  }

  function pause() {
    if (video) video.pause();
  }

  function togglePlay() {
    if (video && !video.paused) {
      pause();
    } else {
      play();
    }
  }

  /* ---------------- 檔案加入 / 清空 ---------------- */

  function addFiles(files) {
    const picked = [];
    for (const f of files) {
      if (!MEDIA_RE.test(f.name)) continue;
      picked.push({ name: f.name, url: URL.createObjectURL(f) });
    }

    if (!picked.length) {
      flashEmpty(t('jb.noMp4'));
      return;
    }

    const wasEmpty = playlist.length === 0;
    playlist.push(...picked);
    renderList();
    updateInfo();
    if (wasEmpty) loadTrack(0, true);
  }

  function clearAll() {
    pause();
    if (video) video.removeAttribute('src');
    for (const p of playlist) {
      try {
        URL.revokeObjectURL(p.url);
      } catch (e) {}
    }
    playlist = [];
    index = -1;
    errStreak = 0;
    renderList();
    updateInfo();
    setPlayingUI(false);
  }

  function flashEmpty(msg) {
    const empty = $('jbEmpty');
    if (!empty) return;
    empty.textContent = msg;
    if (flashTimer) clearTimeout(flashTimer);
    flashTimer = setTimeout(() => {
      empty.textContent = t('jb.empty');
      flashTimer = null;
    }, 2500);
  }

  /* ---------------- UI ---------------- */

  function setPlayingUI(playing) {
    $('jukeboxPanel')?.classList.toggle('playing', playing);
    $('jukeboxBtn')?.classList.toggle('playing', playing);

    $('jbPlayIcon')?.classList.toggle('hidden', playing);
    $('jbPauseIcon')?.classList.toggle('hidden', !playing);

    const btn = $('jbPlay');
    if (btn) btn.title = t(playing ? 'jb.pause' : 'jb.play');
  }

  function updateInfo() {
    const name = $('jbName');
    const count = $('jbCount');
    if (!name || !count) return;

    if (index >= 0 && playlist[index]) {
      name.textContent = playlist[index].name;
      name.title = playlist[index].name;
      count.textContent = (index + 1) + ' / ' + playlist.length;
    } else {
      name.textContent = '—';
      name.title = '';
      count.textContent = playlist.length ? '0 / ' + playlist.length : '';
    }
  }

  function renderList() {
    const list = $('jbList');
    const empty = $('jbEmpty');
    if (!list || !empty) return;

    list.innerHTML = '';

    if (!playlist.length) {
      empty.textContent = t('jb.empty');
      empty.classList.remove('hidden');
      list.classList.add('hidden');
      return;
    }

    empty.classList.add('hidden');
    list.classList.remove('hidden');

    playlist.forEach((p, i) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'jb-item' + (i === index ? ' active' : '');

      const n = document.createElement('span');
      n.className = 'n';
      n.textContent = String(i + 1);

      const nm = document.createElement('span');
      nm.className = 'nm';
      nm.textContent = p.name;
      nm.title = p.name;

      item.appendChild(n);
      item.appendChild(nm);
      item.addEventListener('click', () => loadTrack(i, true));
      list.appendChild(item);
    });
  }

  function applyRepeatUI() {
    const btn = $('jbRepeat');
    if (!btn) return;
    const one = prefs.repeat === 'one';
    btn.classList.toggle('active', one);
    btn.title = t(one ? 'jb.repeatOne' : 'jb.repeatAll');
  }

  /* ---------------- 事件 ---------------- */

  function wire() {
    if (!$('jukeboxPanel')) return;

    $('jukeboxBtn')?.addEventListener('click', () => {
      $('jukeboxPanel').classList.toggle('open');
    });

    $('jukeboxClose')?.addEventListener('click', () => {
      $('jukeboxPanel').classList.remove('open');
    });

    // 點擊面板外關閉(音樂繼續)
    document.addEventListener('click', (e) => {
      const panel = $('jukeboxPanel');
      if (!panel.classList.contains('open')) return;
      if (panel.contains(e.target)) return;
      if ($('jukeboxBtn')?.contains(e.target)) return;
      panel.classList.remove('open');
    });

    $('jbPickFilesBtn')?.addEventListener('click', () => $('jbFiles')?.click());
    $('jbPickFolderBtn')?.addEventListener('click', () => $('jbFolder')?.click());

    $('jbFiles')?.addEventListener('change', (e) => {
      addFiles(e.target.files);
      e.target.value = '';
    });

    $('jbFolder')?.addEventListener('change', (e) => {
      addFiles(e.target.files);
      e.target.value = '';
    });

    $('jbPlay')?.addEventListener('click', togglePlay);
    $('jbRecord')?.addEventListener('click', togglePlay);

    $('jbPrev')?.addEventListener('click', () => step(-1, true));
    $('jbNext')?.addEventListener('click', () => step(1, true));

    $('jbRepeat')?.addEventListener('click', () => {
      prefs.repeat = prefs.repeat === 'one' ? 'all' : 'one';
      savePrefs();
      applyRepeatUI();
    });

    $('jbVol')?.addEventListener('input', (e) => {
      prefs.volume = Number(e.target.value) / 100;
      if (video) video.volume = prefs.volume;
      savePrefs();
    });

    $('jbClear')?.addEventListener('click', clearAll);

    // 初始狀態
    $('jbVol').value = String(Math.round(prefs.volume * 100));
    applyRepeatUI();
    renderList();
    updateInfo();
    setPlayingUI(false);

    // 語言切換時刷新動態 title
    window.addEventListener('go:langchange', () => {
      applyRepeatUI();
      setPlayingUI(video ? !video.paused : false);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();
