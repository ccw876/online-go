/* =========================================================
   線上圍棋 — 衣櫥模組
   - 獨立的皮膚管理面板:棋子皮膚 / 棋盤皮膚(敬請期待)
   - 依賴:GoSettings(偏好)、GoBoard(預覽渲染)、t()(多語系)
   - 預覽在面板開啟「可見後」才渲染,
     確保 canvas clientWidth 正確
========================================================= */

(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);

  function syncTabs(tab) {
    document
      .querySelectorAll('#wardrobeTabs button')
      .forEach(b => b.classList.toggle('checked', b.dataset.tab === tab));

    $('wardrobeStonePanel')
      ?.classList.toggle('hidden', tab !== 'stone');

    $('wardrobeBoardPanel')
      ?.classList.toggle('hidden', tab !== 'board');
  }

  function syncSkinSelection() {
    const current =
      (window.GoSettings && window.GoSettings.get().skin) || 'classic';

    document
      .querySelectorAll('#skinSeg .skin-thumb')
      .forEach(b => b.classList.toggle('checked', b.dataset.value === current));

    window.GoBoard?.updateSkinPreview?.();
  }

  function openWardrobe() {
    syncTabs('stone');
    syncSkinSelection();
    $('wardrobeOverlay')?.classList.remove('hidden');

    /* 面板可見後渲染,寬度才正確 */
    window.GoBoard?.renderSkinPreviews?.();
  }

  function closeWardrobe() {
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

    window.addEventListener('go:langchange', () => {
      window.GoBoard?.updateSkinPreviewName?.();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();
