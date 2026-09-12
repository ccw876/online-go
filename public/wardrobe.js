/* =========================================================
   線上圍棋 — 衣櫥模組
   - 獨立的外觀管理面板:
     棋子皮膚 / 落子特效 / 提子特效 / 最後一手 / 棋盤皮膚(敬請期待)
   - 依賴:GoSettings(偏好)、GoBoard(預覽渲染)、GoFX(特效)、t()(多語系)
   - 預覽在面板開啟「可見後」才渲染,確保 canvas clientWidth 正確
   - 縮圖選條(fx/cap/mk)由 SEGS 配置驅動:
     選取同步、縮圖渲染、預覽循環共用同一套流程
========================================================= */

(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);

  /* 縮圖選項欄設定:key=偏好欄位、prefix=i18n 前缀 */
  const SEGS = [
    {
      id: 'fxSeg', canvas: 'fxPreviewMain', name: 'fxPreviewName',
      key: 'fx', def: 'none', prefix: 'fx.', tab: 'fx',
      panel: 'wardrobeFxPanel', mode: 'oneshot'
    },
    {
      id: 'capSeg', canvas: 'capPreviewMain', name: 'capPreviewName',
      key: 'cap', def: 'none', prefix: 'cap.', tab: 'cap',
      panel: 'wardrobeCapPanel', mode: 'oneshot'
    },
    {
      id: 'mkSeg', canvas: 'mkPreviewMain', name: 'mkPreviewName',
      key: 'marker', def: 'ring', prefix: 'mk.', tab: 'last',
      panel: 'wardrobeLastPanel', mode: 'continuous'
    }
  ];

  const previewTimers = {};

  function currentOf(seg) {
    return (window.GoSettings && window.GoSettings.get()[seg.key]) || seg.def;
  }

  function syncTabs(tab) {
    document
      .querySelectorAll('#wardrobeTabs button')
      .forEach(b => b.classList.toggle('checked', b.dataset.tab === tab));

    $('wardrobeStonePanel')
      ?.classList.toggle('hidden', tab !== 'stone');
    $('wardrobeFxPanel')
      ?.classList.toggle('hidden', tab !== 'fx');
    $('wardrobeCapPanel')
      ?.classList.toggle('hidden', tab !== 'cap');
    $('wardrobeLastPanel')
      ?.classList.toggle('hidden', tab !== 'last');
    $('wardrobeBoardPanel')
      ?.classList.toggle('hidden', tab !== 'board');

    /* 預覽只在所屬分頁可見時運轉 */
    SEGS.forEach(seg => {
      if (seg.tab === tab) startSegPreview(seg);
      else stopSegPreview(seg);
    });
  }

  function syncSkinSelection() {
    const current =
      (window.GoSettings && window.GoSettings.get().skin) || 'classic';

    document
      .querySelectorAll('#skinSeg .skin-thumb')
      .forEach(b => b.classList.toggle('checked', b.dataset.value === current));

    window.GoBoard?.updateSkinPreview?.();
  }

  function syncSegSelection(seg) {
    const current = currentOf(seg);
    document
      .querySelectorAll(`#${seg.id} .fx-thumb`)
      .forEach(b => b.classList.toggle('checked', b.dataset.value === current));
    const nameEl = $(seg.name);
    if (nameEl) nameEl.textContent = t(seg.prefix + current);
  }

  function renderSegThumbs(seg) {
    const draw = seg.mode === 'continuous'
      ? window.GoFX?.renderMarkerThumb
      : window.GoFX?.renderThumb;
    document.querySelectorAll(`#${seg.id} .fx-thumb`).forEach(b => {
      draw?.(b.querySelector('canvas'), b.dataset.value);
    });
  }

  function startSegPreview(seg) {
    stopSegPreview(seg);
    const canvas = $(seg.canvas);
    if (!canvas) return;

    if (seg.mode === 'continuous') {
      /* 標記預覽:連續動畫,交給 rAF */
      const loop = () => {
        window.GoFX?.previewMarker?.(canvas, currentOf(seg));
        previewTimers[seg.id] = requestAnimationFrame(loop);
      };
      loop();
    } else {
      /* 單發特效預覽:週期性重播 */
      const play = () => window.GoFX?.playOnCanvas?.(canvas, currentOf(seg));
      play();
      previewTimers[seg.id] = setInterval(play, 2300);
    }
  }

  function stopSegPreview(seg) {
    const timer = previewTimers[seg.id];
    if (!timer) return;
    if (seg.mode === 'continuous') {
      cancelAnimationFrame(timer);
      window.GoFX?.stopMarkerPreview?.($(seg.canvas));
    } else {
      clearInterval(timer);
    }
    previewTimers[seg.id] = 0;
  }

  function openWardrobe() {
    syncTabs('stone');
    syncSkinSelection();
    SEGS.forEach(seg => {
      syncSegSelection(seg);
      renderSegThumbs(seg);
    });
    $('wardrobeOverlay')?.classList.remove('hidden');

    /* 面板可見後渲染,寬度才正確 */
    window.GoBoard?.renderSkinPreviews?.();
  }

  function closeWardrobe() {
    SEGS.forEach(stopSegPreview);
    $('wardrobeOverlay')?.classList.add('hidden');
  }

  function wire() {
    if (!$('wardrobeOverlay')) return;

    $('wardrobeBtn')?.addEventListener('click', openWardrobe);
    $('wardrobeClose')?.addEventListener('click', closeWardrobe);

    $('wardrobeOverlay').addEventListener('click', e => {
      if (e.target === e.currentTarget) closeWardrobe();
    });

    document.addEventListener('keydown', e => {
      if (
        e.key === 'Escape' &&
        $('wardrobeOverlay') &&
        !$('wardrobeOverlay').classList.contains('hidden')
      ) {
        closeWardrobe();
      }
    });

    document.querySelectorAll('#wardrobeTabs button').forEach(b => {
      b.addEventListener('click', () => syncTabs(b.dataset.tab));
    });

    document.querySelectorAll('#skinSeg .skin-thumb').forEach(b => {
      b.addEventListener('click', () => {
        window.GoSettings.set({ skin: b.dataset.value });
        syncSkinSelection();
      });
    });

    SEGS.forEach(seg => {
      document.querySelectorAll(`#${seg.id} .fx-thumb`).forEach(b => {
        b.addEventListener('click', () => {
          window.GoSettings.set({ [seg.key]: b.dataset.value });
          syncSegSelection(seg);

          /* 預覽即時切換 */
          if (!$(`#${seg.panel}`)?.classList.contains('hidden')) {
            startSegPreview(seg);
          }
        });
      });
    });

    window.addEventListener('go:langchange', () => {
      window.GoBoard?.updateSkinPreviewName?.();
      SEGS.forEach(syncSegSelection);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();
