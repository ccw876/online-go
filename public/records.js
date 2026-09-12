/* =========================================================
   線上圍棋 — 戰績模組
   - 記錄最近十場「完整對局」(已終局;中途退出不計)
   - 內容:棋盤大小、勝負、目差、手數、完整棋譜(state)
   - 存於 localStorage 'goRecords.v1'
   - 同一局重複記錄(終局時 + 離開時點目更新)
     以簽章(size:hash:手數)識別,後者覆寫前者
   - 對外提供:
       GoRecords.save(game, mode, myColor)
       GoRecords.list()
       GoRecords.resultText(record)
       GoRecords.open() / close()
========================================================= */

(() => {
  'use strict';

  const KEY = 'goRecords.v1';
  const MAX = 10;

  const $ = (id) => document.getElementById(id);

  function list() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '[]');
    } catch (e) {
      return [];
    }
  }

  function persist(records) {
    try {
      localStorage.setItem(KEY, JSON.stringify(records));
    } catch (e) {}
  }

  function save(game, mode, myColor) {
    if (!game || !game.gameOver) return;
    if (!game.history || game.history.length === 0) return;

    const state = game.getFullState();
    const score = game.calculateChineseScore(7.5);
    const sig =
      state.size + ':' + game.hash() + ':' + state.history.length;

    const records = list();
    const newest = records[0];

    if (newest && newest.sig === sig) {
      /* 同一局:以最新資料(點目後的終盤成績)覆寫 */
      records[0] = makeRecord(state, score, sig, mode, myColor, newest.date);
    } else {
      records.unshift(makeRecord(state, score, sig, mode, myColor, new Date().toISOString()));
      if (records.length > MAX) records.length = MAX;
    }

    persist(records);
  }

  function makeRecord(state, score, sig, mode, myColor, date) {
    return {
      sig,
      date,
      size: state.size,
      mode: mode === 'hotseat' ? 'hotseat' : 'p2p',
      myColor: mode === 'hotseat' ? null : myColor,
      winner: score.winner,
      diff: +score.diff.toFixed(1),
      blackTotal: +score.blackTotal.toFixed(1),
      whiteTotal: +score.whiteTotal.toFixed(1),
      moves: state.history.length,
      state
    };
  }

  function resultText(rec) {
    const diff = rec.diff.toFixed(1);
    const winnerName =
      rec.winner === 1
        ? t('player.black')
        : t('player.white');

    if (rec.mode === 'hotseat') {
      return t('dyn.gameOver', { w: winnerName, d: diff });
    }

    if (rec.myColor === rec.winner) {
      return t('records.youWin', { d: diff });
    }

    return t('records.youLose', { d: diff });
  }

  function fmtDate(iso) {
    const d = new Date(iso);
    const p = (n) => String(n).padStart(2, '0');
    return (
      (d.getMonth() + 1) + '/' + p(d.getDate()) +
      ' ' + p(d.getHours()) + ':' + p(d.getMinutes())
    );
  }

  function render() {
    const records = list();
    const listBox = $('recordsList');
    const emptyBox = $('recordsEmpty');
    if (!listBox) return;

    listBox.innerHTML = '';
    if (emptyBox) {
      emptyBox.classList.toggle('hidden', records.length > 0);
    }

    records.forEach((rec, i) => {
      const row = document.createElement('div');
      row.className = 'record-row';

      const result = resultText(rec);
      const outcome =
        rec.mode !== 'hotseat'
          ? (rec.myColor === rec.winner ? 'win' : 'lose')
          : 'neutral';

      row.innerHTML = `
        <div class="record-main">
          <div class="record-line1">
            <span class="record-result ${outcome}">${result}</span>
            <span class="record-meta">${rec.size} × ${rec.size}</span>
            <span class="record-meta">${rec.moves}${t('records.movesUnit')}</span>
            <span class="record-date">${fmtDate(rec.date)}</span>
          </div>
          <div class="record-line2">
            ${t('player.black')} ${rec.blackTotal} : ${rec.whiteTotal} ${t('player.white')}
            ${rec.mode === 'hotseat' ? '· ' + t('records.modeLocal') : ''}
          </div>
        </div>
        <button type="button" class="btn small" data-replay="${i}">
          ${t('records.replay')}
        </button>
      `;
      listBox.appendChild(row);
    });
  }

  function open() {
    render();
    $('recordsOverlay')?.classList.remove('hidden');
  }

  function close() {
    $('recordsOverlay')?.classList.add('hidden');
  }

  function wire() {
    if (!$('recordsOverlay')) return;

    $('recordsBtn')?.addEventListener('click', open);
    $('recordsClose')?.addEventListener('click', close);

    $('recordsOverlay').addEventListener('click', e => {
      if (e.target === e.currentTarget) close();
    });

    document.addEventListener('keydown', e => {
      if (
        e.key === 'Escape' &&
        $('recordsOverlay') &&
        !$('recordsOverlay').classList.contains('hidden')
      ) {
        close();
      }
    });

    $('recordsList')?.addEventListener('click', e => {
      const btn = e.target.closest('[data-replay]');
      if (!btn) return;
      const idx = Number(btn.dataset.replay);
      close();
      window.GoReplay?.start(idx);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }

  window.GoRecords = { save, list, resultText, open, close };
})();
