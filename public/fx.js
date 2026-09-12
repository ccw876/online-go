/* =========================================================
   線上圍棋 — 落子特效模組
   - 依 GoSettings.get().fx 決定落子時播放的特效(預設 none)
   - 特效繪於覆蓋 #boardCanvas 的透明 canvas 上,
     pointer-events:none,不影響落子點擊
   - 特法定義於 EFFECTS 註冊表:新增特效只需
     加一組 make(隨機素材)/draw(繪製)並註冊 dur 與縮圖定格點
   - 對外提供:
       GoFX.stone(x, y, color)     落子時播放(doMove / applyMoveRemote 呼叫)
       GoFX.playOnCanvas(c, mode)  在指定 canvas 播放一次(衣櫥大預覽循環)
       GoFX.renderThumb(c, mode)   縮圖靜態定格(衣櫥縮圖)
========================================================= */

(() => {
  'use strict';

  let overlay = null;   /* 棋盤覆蓋層 canvas */
  let rafId = 0;
  const targets = [];   /* { canvas, ctx, anims, bg } */

  const easeOut = t => 1 - Math.pow(1 - t, 3);

  /* ---------------- 繪圖目標註冊 ---------------- */

  function targetFor(canvas) {
    let t = targets.find(o => o.canvas === canvas);
    if (!t) {
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      t = { canvas, ctx, anims: [], bg: null };
      targets.push(t);
    }
    return t;
  }

  /* 依顯示尺寸同步 canvas 解析度,回傳 CSS 尺寸;隱藏中回傳 null */
  function syncToDisplay(t) {
    const rect = t.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(rect.width * dpr);
    const h = Math.round(rect.height * dpr);
    if (t.canvas.width !== w || t.canvas.height !== h) {
      t.canvas.width = w;
      t.canvas.height = h;
    }
    return { w: rect.width, h: rect.height, dpr };
  }

  /* ---------------- 場景繪製(衣櫥預覽/縮圖用) ---------------- */

  function paintStone(ctx, x, y, r) {
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.42, r * 0.12, x, y, r);
    g.addColorStop(0, '#59616b');
    g.addColorStop(1, '#0e1114');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function paintWoodScene(ctx, w, h, cell) {
    const wg = ctx.createLinearGradient(0, 0, w, h);
    wg.addColorStop(0, '#e6c38a');
    wg.addColorStop(1, '#d2a55c');
    ctx.fillStyle = wg;
    ctx.fillRect(0, 0, w, h);

    const cx = w * 0.5;
    const cy = h * 0.62;

    ctx.strokeStyle = 'rgba(84,54,16,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const dx of [-1, 0, 1]) {
      ctx.moveTo(cx + dx * cell, 0);
      ctx.lineTo(cx + dx * cell, h);
    }
    for (const dy of [-1, 0, 1]) {
      ctx.moveTo(0, cy + dy * cell);
      ctx.lineTo(w, cy + dy * cell);
    }
    ctx.stroke();

    paintStone(ctx, cx, cy, cell * 0.47);
    return { cx, cy };
  }

  /* ---------------- 氣勢如虹:白煙迸發 ---------------- */

  function makePuffs(cell) {
    const puffs = [];
    const N = 16;
    for (let i = 0; i < N; i++) {
      /* 前段與最後數縷集中向上,形成上升煙柱;其餘環繞四散 */
      const upward = i < 5 || i >= N - 2;
      const ang = upward
        ? -Math.PI * (0.25 + Math.random() * 0.5)
        : (i / N) * Math.PI * 2 + (Math.random() - 0.5) * 0.7;
      puffs.push({
        ang,
        dist: cell * (1.2 + Math.random() * 0.9),
        size: cell * (0.5 + Math.random() * 0.42),
        rise: cell * (0.7 + Math.random() * 0.9),
        wobA: cell * (0.1 + Math.random() * 0.14),
        wobF: 1.4 + Math.random() * 2.4,
        phase: Math.random() * Math.PI * 2,
        delay: Math.random() * 0.24,
        life: 0.66 + Math.random() * 0.3,
        alpha: 0.3 + Math.random() * 0.18
      });
    }
    return puffs;
  }

  function drawQi(ctx, a, p) {
    const { x, y, cell } = a;
    const q = easeOut(p);
    const fade = 1 - p;

    /* 中心白光一閃 */
    if (p < 0.2) {
      const f = p / 0.2;
      ctx.fillStyle = `rgba(255,255,255,${0.5 * (1 - f)})`;
      ctx.beginPath();
      ctx.arc(x, y, cell * (0.35 + 0.5 * f), 0, Math.PI * 2);
      ctx.fill();
    }

    /* 擴散光暈 */
    const gr = cell * (0.55 + 1.5 * q);
    const g = ctx.createRadialGradient(x, y, cell * 0.1, x, y, gr);
    g.addColorStop(0, `rgba(255,255,255,${0.4 * fade})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, gr, 0, Math.PI * 2);
    ctx.fill();

    /* 兩道氣環(衝擊波) */
    for (const [delay, w] of [[0, 0.09], [0.18, 0.06]]) {
      const rp = (p - delay) / (1 - delay);
      if (rp <= 0 || rp >= 1) continue;
      const rq = easeOut(rp);
      ctx.strokeStyle = `rgba(255,255,255,${0.85 * Math.pow(1 - rp, 1.5)})`;
      ctx.lineWidth = Math.max(1, cell * w * (1 - 0.6 * rp));
      ctx.beginPath();
      ctx.arc(x, y, cell * (0.45 + 1.7 * rq), 0, Math.PI * 2);
      ctx.stroke();
    }

    /* 十六縷濃煙:外擴、上飄、搖曳,以實體煙霧繪製 */
    for (const s of a.puffs) {
      const f = (p - s.delay) / s.life;
      if (f <= 0 || f >= 1) continue;
      const fq = easeOut(f);
      const drift = s.dist * fq;
      const wob = Math.sin(s.phase + f * s.wobF * Math.PI);
      const wx = x + Math.cos(s.ang) * drift + wob * s.wobA * f;
      const wy = y + Math.sin(s.ang) * drift * 0.72 - s.rise * fq - wob * s.wobA * f * 0.6;
      const r = s.size * (0.5 + 1.15 * fq);
      const env = f < 0.14 ? f / 0.14 : 1 - (f - 0.14) / 0.86;
      const al = s.alpha * env * (1 - p * 0.12);
      const sg = ctx.createRadialGradient(wx, wy, r * 0.06, wx, wy, r);
      sg.addColorStop(0, `rgba(252,252,253,${al})`);
      sg.addColorStop(0.45, `rgba(248,248,250,${al * 0.72})`);
      sg.addColorStop(1, 'rgba(240,240,244,0)');
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(wx, wy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ---------------- 神機妙算:數學符號飄升 ---------------- */

  const MATH_GLYPHS =
    ['∫', '∑', 'π', '√', '∞', 'Δ', 'θ', 'λ', '±', '≈', '∂', 'φ'];

  function makeGlyphs(cell) {
    const glyphs = [];
    const N = 11;
    for (let i = 0; i < N; i++) {
      const upward = i < 4;
      glyphs.push({
        ch: MATH_GLYPHS[(Math.random() * MATH_GLYPHS.length) | 0],
        ang: upward
          ? -Math.PI * (0.2 + Math.random() * 0.6)
          : Math.random() * Math.PI * 2,
        dist: cell * (0.9 + Math.random() * 0.9),
        rise: cell * (0.8 + Math.random() * 1.0),
        size: cell * (0.38 + Math.random() * 0.34),
        rot: (Math.random() - 0.5) * 1.4,
        wobA: cell * (0.08 + Math.random() * 0.12),
        wobF: 1.4 + Math.random() * 2.2,
        phase: Math.random() * Math.PI * 2,
        delay: Math.random() * 0.26,
        life: 0.6 + Math.random() * 0.32,
        alpha: 0.55 + Math.random() * 0.3
      });
    }
    return glyphs;
  }

  function drawMath(ctx, a, p) {
    const { x, y, cell } = a;

    /* 底部微光 */
    const gr = cell * (0.7 + 1.1 * easeOut(p));
    const g = ctx.createRadialGradient(x, y, cell * 0.1, x, y, gr);
    g.addColorStop(0, `rgba(255,255,255,${0.28 * (1 - p)})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, gr, 0, Math.PI * 2);
    ctx.fill();

    /* 數學符號:外擴、飄升、緩緩旋轉 */
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const s of a.glyphs) {
      const f = (p - s.delay) / s.life;
      if (f <= 0 || f >= 1) continue;
      const fq = easeOut(f);
      const drift = s.dist * fq;
      const wob = Math.sin(s.phase + f * s.wobF * Math.PI);
      const wx = x + Math.cos(s.ang) * drift + wob * s.wobA * f;
      const wy = y + Math.sin(s.ang) * drift * 0.5 - s.rise * fq - wob * s.wobA * f * 0.5;
      const env = f < 0.18 ? f / 0.18 : 1 - (f - 0.18) / 0.82;
      ctx.save();
      ctx.translate(wx, wy);
      ctx.rotate(s.rot * fq);
      ctx.font = `italic ${s.size}px Georgia, 'Times New Roman', serif`;
      ctx.fillStyle = `rgba(250,250,253,${s.alpha * env})`;
      ctx.fillText(s.ch, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }

  /* ---------------- 星火燎原:金色火星迸射 ---------------- */

  function makeSparks(cell) {
    const sparks = [];
    const N = 20;
    for (let i = 0; i < N; i++) {
      sparks.push({
        ang: Math.random() * Math.PI * 2,
        v: cell * (0.9 + Math.random() * 1.6),
        g: cell * 2.4,
        delay: Math.random() * 0.15,
        life: 0.7 + Math.random() * 0.3,
        phase: Math.random() * Math.PI * 2
      });
    }
    return { sparks };
  }

  function drawSpark(ctx, a, p) {
    const { x, y, cell } = a;
    const durS = a.dur / 1000;

    /* 暖色爆閃 */
    if (p < 0.18) {
      const f = p / 0.18;
      const g = ctx.createRadialGradient(x, y, cell * 0.05, x, y, cell * (0.5 + 0.9 * f));
      g.addColorStop(0, `rgba(255,240,200,${0.55 * (1 - f)})`);
      g.addColorStop(1, 'rgba(255,180,80,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, cell * (0.5 + 0.9 * f), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const s of a.sparks) {
      const f = (p - s.delay) / s.life;
      if (f <= 0 || f >= 1) continue;
      const tt = f * s.life * durS;
      const d = s.v * tt;
      const droop = 0.5 * s.g * tt * tt;
      const hx = x + Math.cos(s.ang) * d;
      const hy = y + Math.sin(s.ang) * d * 0.85 + droop;
      const tt2 = Math.max(0, tt - 0.07);
      const d2 = s.v * tt2;
      const droop2 = 0.5 * s.g * tt2 * tt2;
      const tx = x + Math.cos(s.ang) * d2;
      const ty = y + Math.sin(s.ang) * d2 * 0.85 + droop2;
      const flicker = 0.7 + 0.3 * Math.sin(f * 28 + s.phase);
      const al = (1 - f) * flicker;
      ctx.strokeStyle = `rgba(255,170,70,${0.8 * al})`;
      ctx.lineWidth = Math.max(1, cell * 0.07 * (1 - f * 0.6));
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(hx, hy);
      ctx.stroke();
      ctx.fillStyle = `rgba(255,236,190,${al})`;
      ctx.beginPath();
      ctx.arc(hx, hy, Math.max(1, cell * 0.06 * (1 - f * 0.5)), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ---------------- 漣漪陣陣:水波蕩開 ---------------- */

  function makeRings(cell) {
    return {
      waves: [0, 0.18, 0.38].map(delay => ({
        delay,
        ph1: Math.random() * Math.PI * 2,
        ph2: Math.random() * Math.PI * 2
      })),
      drops: Array.from({ length: 6 }, () => ({
        ang: Math.random() * Math.PI * 2,
        d: cell * (0.25 + Math.random() * 0.4),
        size: cell * (0.045 + Math.random() * 0.035),
        delay: Math.random() * 0.05
      })),
      ph: Math.random() * Math.PI * 2
    };
  }

  /* 半徑帶細微起伏的圓:模擬水面波紋的不均勻 */
  function wavyCircle(ctx, x, y, R, amp, ph1, ph2, style, width) {
    const SEG = 56;
    ctx.strokeStyle = style;
    ctx.lineWidth = width;
    ctx.beginPath();
    for (let i = 0; i <= SEG; i++) {
      const th = (i / SEG) * Math.PI * 2;
      const rr =
        R * (1 + amp * Math.sin(3 * th + ph1) + amp * 0.7 * Math.sin(5 * th + ph2));
      const px = x + Math.cos(th) * rr;
      const py = y + Math.sin(th) * rr;
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  }

  function drawRipple(ctx, a, p) {
    const { x, y, cell } = a;

    /* 水光暈:隨擴散變大、漸淡 */
    const sheen = cell * (0.8 + 1.4 * easeOut(p));
    const g = ctx.createRadialGradient(x, y, cell * 0.05, x, y, sheen);
    g.addColorStop(0, `rgba(185,222,255,${0.2 * (1 - p)})`);
    g.addColorStop(0.65, `rgba(185,222,255,${0.09 * (1 - p)})`);
    g.addColorStop(1, 'rgba(185,222,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, sheen, 0, Math.PI * 2);
    ctx.fill();

    /* 入水濺花:細小水珠上跳後沒入 */
    if (p < 0.16) {
      for (const d of a.drops) {
        const f = (p - d.delay) / 0.16;
        if (f <= 0 || f >= 1) continue;
        const lift = Math.sin(f * Math.PI);
        const dist = d.d * (0.4 + 0.6 * f);
        const al = 0.75 * (1 - f);
        ctx.fillStyle = `rgba(225,242,255,${al})`;
        ctx.beginPath();
        ctx.arc(
          x + Math.cos(d.ang) * dist,
          y + Math.sin(d.ang) * dist,
          Math.max(0.5, d.size * (1 - 0.4 * f) * (0.75 + 0.45 * lift)),
          0, Math.PI * 2
        );
        ctx.fill();
      }
    }

    /* 三道波前:不規則波峰 + 滑動高光 + 尾流 + 波谷淡影 */
    for (const w of a.waves) {
      const f = (p - w.delay) / (1 - w.delay);
      if (f <= 0 || f >= 1) continue;
      const fq = easeOut(f);
      const R = cell * (0.32 + 2.15 * fq);
      const decay = Math.pow(1 - f, 1.25);
      const amp = 0.018 * (1 + f * 1.6);

      /* 波谷:緊貼主波內側的淡影,做出水面起伏的層次 */
      wavyCircle(
        ctx, x, y, R * 0.9, amp, w.ph1, w.ph2,
        `rgba(70,105,150,${0.1 * decay})`,
        Math.max(0.8, cell * 0.1 * (1 - f * 0.6))
      );

      /* 主波峰 */
      wavyCircle(
        ctx, x, y, R, amp, w.ph1, w.ph2,
        `rgba(208,233,255,${0.6 * decay})`,
        Math.max(0.8, cell * 0.09 * (1 - f * 0.7))
      );

      /* 環繞高光:三段亮弧在波峰上滑動 */
      for (let k = 0; k < 3; k++) {
        const ha = w.ph2 + k * 2.09 + f * 0.9;
        ctx.strokeStyle = `rgba(240,250,255,${0.75 * decay})`;
        ctx.lineWidth = Math.max(1, cell * 0.05 * (1 - f * 0.5));
        ctx.beginPath();
        ctx.arc(x, y, R, ha, ha + 0.45);
        ctx.stroke();
      }

      /* 尾流:主波後方兩道漸弱餘波 */
      wavyCircle(
        ctx, x, y, R * 0.8, amp * 0.8, w.ph1 + 0.6, w.ph2,
        `rgba(205,232,255,${0.28 * decay})`,
        Math.max(0.7, cell * 0.06 * (1 - f * 0.7))
      );
      wavyCircle(
        ctx, x, y, R * 0.63, amp * 0.6, w.ph1 + 1.3, w.ph2 + 0.4,
        `rgba(205,232,255,${0.14 * decay})`,
        Math.max(0.6, cell * 0.045 * (1 - f * 0.7))
      );
    }
  }

  /* ---------------- 落櫻繽紛:花瓣飄落 ---------------- */

  function makePetals(cell) {
    const petals = [];
    const N = 11;
    for (let i = 0; i < N; i++) {
      petals.push({
        ang: Math.random() * Math.PI * 2,
        r0: cell * (0.1 + Math.random() * 0.55),
        from: -cell * (0.9 + Math.random() * 0.9),
        to: cell * (0.7 + Math.random() * 0.7),
        size: cell * (0.2 + Math.random() * 0.16),
        swayA: cell * (0.18 + Math.random() * 0.26),
        swayF: 1.2 + Math.random() * 1.8,
        phase: Math.random() * Math.PI * 2,
        rot0: Math.random() * Math.PI,
        delay: Math.random() * 0.3,
        life: 0.62 + Math.random() * 0.3,
        alpha: 0.7 + Math.random() * 0.25
      });
    }
    return { petals };
  }

  function drawPetal(ctx, a, p) {
    const { x, y, cell } = a;

    /* 淡粉光暈 */
    const g = ctx.createRadialGradient(x, y, cell * 0.05, x, y, cell);
    g.addColorStop(0, `rgba(255,200,215,${0.26 * (1 - p)})`);
    g.addColorStop(1, 'rgba(255,200,215,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, cell, 0, Math.PI * 2);
    ctx.fill();

    for (const s of a.petals) {
      const f = (p - s.delay) / s.life;
      if (f <= 0 || f >= 1) continue;
      const sway = Math.sin(s.phase + f * s.swayF * Math.PI);
      const wx = x + Math.cos(s.ang) * s.r0 + sway * s.swayA;
      const wy = y + s.from + (s.to - s.from) * f;
      const rot = s.rot0 + sway * 0.7;
      const al = s.alpha * (f < 0.15 ? f / 0.15 : 1 - (f - 0.15) / 0.85);
      ctx.save();
      ctx.translate(wx, wy);
      ctx.rotate(rot);
      const pg = ctx.createLinearGradient(0, -s.size, 0, s.size);
      pg.addColorStop(0, `rgba(255,225,235,${al})`);
      pg.addColorStop(1, `rgba(255,140,170,${al})`);
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.ellipse(0, 0, s.size, s.size * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /* ---------------- 雷霆萬鈞:電弧纏繞 ---------------- */

  function makeBolts(cell) {
    const bolts = [];
    const N = 4;
    for (let i = 0; i < N; i++) {
      const ang = (i / N) * Math.PI * 2 + (Math.random() - 0.5) * 0.8;
      const r1 = cell * (1.4 + Math.random() * 0.7);
      const S = 7;
      const jseed = Math.random() * 10;
      const pts = [];
      for (let j = 0; j <= S; j++) {
        const t = j / S;
        const r = cell * 0.3 + (r1 - cell * 0.3) * t;
        const jitter =
          (Math.sin(jseed + j * 2.7) + (Math.random() - 0.5)) *
          cell * 0.28 * Math.sin(Math.PI * t);
        pts.push({
          x: Math.cos(ang) * r - Math.sin(ang) * jitter,
          y: Math.sin(ang) * r + Math.cos(ang) * jitter
        });
      }
      bolts.push({ pts, phase: Math.random() * Math.PI * 2 });
    }
    return { bolts };
  }

  function strokePts(ctx, x, y, pts) {
    ctx.beginPath();
    ctx.moveTo(x + pts[0].x, y + pts[0].y);
    for (let j = 1; j < pts.length; j++) ctx.lineTo(x + pts[j].x, y + pts[j].y);
    ctx.stroke();
  }

  function drawBolt(ctx, a, p) {
    const { x, y, cell } = a;

    /* 白閃 */
    if (p < 0.16) {
      const f = p / 0.16;
      ctx.fillStyle = `rgba(230,245,255,${0.5 * (1 - f)})`;
      ctx.beginPath();
      ctx.arc(x, y, cell * (0.4 + 0.6 * f), 0, Math.PI * 2);
      ctx.fill();
    }

    /* 電弧光環 */
    const haloF = p < 0.6 ? p / 0.6 : 1;
    ctx.strokeStyle = `rgba(160,210,255,${0.4 * (1 - p)})`;
    ctx.lineWidth = Math.max(1, cell * 0.06);
    ctx.beginPath();
    ctx.arc(x, y, cell * (0.55 + 0.9 * easeOut(haloF)), 0, Math.PI * 2);
    ctx.stroke();

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const b of a.bolts) {
      /* 閃爍:部分幀隱沒 */
      const gate = Math.sin(p * 40 + b.phase);
      if (gate < -0.35) continue;
      const al = 0.9 * Math.pow(1 - p, 0.8) * (0.6 + 0.4 * gate);
      ctx.strokeStyle = `rgba(140,200,255,${al * 0.3})`;
      ctx.lineWidth = Math.max(2, cell * 0.16 * (1 - p * 0.5));
      strokePts(ctx, x, y, b.pts);
      ctx.strokeStyle = `rgba(235,248,255,${al})`;
      ctx.lineWidth = Math.max(1, cell * 0.055 * (1 - p * 0.5));
      strokePts(ctx, x, y, b.pts);
    }
    ctx.restore();
  }

  /* ---------------- 最後一手標記 ---------------- */

  function drawRingMarker(ctx, x, y, cell, alpha) {
    ctx.strokeStyle = `rgba(235,64,52,${alpha})`;
    ctx.lineWidth = Math.max(1.4, cell * 0.085);
    ctx.beginPath();
    ctx.arc(x, y, cell * 0.55, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawMarker(ctx, m, now) {
    const { x, y, cell } = m;
    const t = m.born ? (now - m.born) / 1000 : 0;

    if (m.style === 'pulse') {
      /* 呼吸光暈:柔光明滅、外圈微脹縮 */
      const s = 0.5 + 0.5 * Math.sin(t * 3.4);
      const r = cell * (0.52 + 0.09 * s);
      const al = 0.3 + 0.35 * s;
      const g = ctx.createRadialGradient(x, y, cell * 0.4, x, y, r * 1.55);
      g.addColorStop(0, `rgba(255,120,80,${al * 0.55})`);
      g.addColorStop(1, 'rgba(255,120,80,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r * 1.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(255,110,70,${0.45 + 0.4 * s})`;
      ctx.lineWidth = Math.max(1.4, cell * 0.07);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
    } else if (m.style === 'blink') {
      /* 閃爍提醒:紅圈明滅 */
      const s = 0.5 + 0.5 * Math.sin(t * 5.5);
      drawRingMarker(ctx, x, y, cell, 0.25 + 0.75 * s);
    } else if (m.style === 'spin') {
      /* 迴旋光環:光弧繞棋子旋轉 */
      const a0 = t * 2.2;
      ctx.strokeStyle = 'rgba(255,96,64,0.95)';
      ctx.lineWidth = Math.max(1.6, cell * 0.085);
      ctx.beginPath();
      ctx.arc(x, y, cell * 0.56, a0, a0 + Math.PI * 1.45);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,150,110,0.55)';
      ctx.lineWidth = Math.max(1.2, cell * 0.06);
      ctx.beginPath();
      ctx.arc(x, y, cell * 0.72, -t * 1.5, -t * 1.5 + Math.PI * 0.8);
      ctx.stroke();
    } else if (m.style === 'stars') {
      /* 星辰環繞:小星星繞棋子旋轉、明滅 */
      const key = 'stars:' + Math.round(cell);
      if (m.exKey !== key) {
        m.exKey = key;
        m.stars = makeOrbitStars(cell);
      }
      for (const s of m.stars) {
        const a = t * s.speed + s.phase;
        const wx = x + Math.cos(a) * s.rx;
        const wy = y + Math.sin(a) * s.ry;
        const tw = 0.55 + 0.45 * Math.sin(t * 4 + s.phase * 3);
        const r = s.size * (0.75 + 0.35 * tw);
        ctx.fillStyle = `rgba(255,232,160,${0.18 * tw})`;
        ctx.beginPath();
        ctx.arc(wx, wy, r * 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(255,244,200,${0.65 + 0.35 * tw})`;
        starPath(ctx, wx, wy, r, t * 0.8 + s.phase);
        ctx.fill();
      }
    } else if (m.style === 'planet') {
      /* 行星公轉:行星沿橢圓軌道繞棋子運行 */
      const key = 'planet:' + Math.round(cell);
      if (m.exKey !== key) {
        m.exKey = key;
        m.planets = makePlanets(cell);
      }
      for (const p of m.planets) {
        ctx.strokeStyle = 'rgba(200,215,235,0.24)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(x, y, p.rx, p.rx * 0.5, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      for (const p of m.planets) {
        const a = t * p.speed + p.phase;
        const wx = x + Math.cos(a) * p.rx;
        const wy = y + Math.sin(a) * p.rx * 0.5;
        const g = ctx.createRadialGradient(
          wx - p.r * 0.3, wy - p.r * 0.3, p.r * 0.15, wx, wy, p.r
        );
        g.addColorStop(0, p.c1);
        g.addColorStop(1, p.c2);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(wx, wy, p.r, 0, Math.PI * 2);
        ctx.fill();
        if (p.ring) {
          ctx.strokeStyle = 'rgba(230,210,170,0.75)';
          ctx.lineWidth = Math.max(0.8, p.r * 0.22);
          ctx.beginPath();
          ctx.ellipse(wx, wy, p.r * 1.7, p.r * 0.62, -0.45, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    } else if (m.style === 'tornado') {
      /* 龍捲風:螺旋渦臂與碎屑以棋子為中心盤旋 */
      const key = 'tornado:' + Math.round(cell);
      if (m.exKey !== key) {
        m.exKey = key;
        m.tornado = makeTornado(cell);
      }
      const g = ctx.createRadialGradient(x, y, cell * 0.1, x, y, cell * 1.3);
      g.addColorStop(0, 'rgba(225,233,242,0.22)');
      g.addColorStop(1, 'rgba(225,233,242,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, cell * 1.3, 0, Math.PI * 2);
      ctx.fill();

      ctx.lineCap = 'round';
      for (const arm of m.tornado.arms) {
        ctx.strokeStyle = `rgba(238,243,249,${arm.alpha})`;
        ctx.lineWidth = Math.max(1.2, cell * 0.075);
        ctx.beginPath();
        const SEG = 22;
        for (let j = 0; j <= SEG; j++) {
          const f = j / SEG;
          const ang = arm.phase + t * 5.2 - f * 2.6;
          const r = cell * (0.25 + f * 1.05);
          const px = x + Math.cos(ang) * r;
          const py = y + Math.sin(ang) * r * 0.8;
          if (j) ctx.lineTo(px, py);
          else ctx.moveTo(px, py);
        }
        ctx.stroke();
      }
      for (const d of m.tornado.debris) {
        const a = t * d.speed + d.phase;
        ctx.fillStyle = `rgba(230,238,246,${d.alpha})`;
        ctx.beginPath();
        ctx.arc(
          x + Math.cos(a) * d.rx,
          y + Math.sin(a) * d.rx * 0.78,
          d.size, 0, Math.PI * 2
        );
        ctx.fill();
      }
    } else {
      /* ring:靜態紅圈(棋盤自繪時覆蓋層不會收到) */
      drawRingMarker(ctx, x, y, cell, 1);
    }
  }

  /* 環繞類標記的素材 */

  function starPath(ctx, x, y, r, rot) {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const ang = rot + i * Math.PI / 4;
      const rr = i % 2 === 0 ? r : r * 0.38;
      const px = x + Math.cos(ang) * rr;
      const py = y + Math.sin(ang) * rr;
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    }
    ctx.closePath();
  }

  function makeOrbitStars(cell) {
    const stars = [];
    const N = 6;
    for (let i = 0; i < N; i++) {
      const rx = cell * (0.78 + (i / N) * 0.62);
      stars.push({
        rx,
        ry: rx * 0.55,
        speed: (1.1 + Math.random() * 0.9) * (i % 2 ? 1 : -1),
        phase: (i / N) * Math.PI * 2,
        size: cell * (0.12 + Math.random() * 0.06)
      });
    }
    return stars;
  }

  function makePlanets(cell) {
    return [
      { rx: cell * 0.78, speed: 1.6, r: cell * 0.11, c1: '#9fd8ff', c2: '#2a6fb8', ring: false, phase: 0 },
      { rx: cell * 1.08, speed: -1.0, r: cell * 0.14, c1: '#ffd9a0', c2: '#c96a2b', ring: true, phase: 2.1 },
      { rx: cell * 1.38, speed: 0.65, r: cell * 0.12, c1: '#d9c2ff', c2: '#6b4bb8', ring: false, phase: 4.2 }
    ];
  }

  function makeTornado(cell) {
    return {
      arms: [0, 1, 2].map(i => ({
        phase: (i / 3) * Math.PI * 2,
        alpha: 0.55 + i * 0.13
      })),
      debris: Array.from({ length: 8 }, () => ({
        rx: cell * (0.5 + Math.random() * 0.85),
        speed: 3.5 + Math.random() * 2.5,
        phase: Math.random() * Math.PI * 2,
        size: Math.max(0.9, cell * (0.035 + Math.random() * 0.035)),
        alpha: 0.45 + Math.random() * 0.35
      }))
    };
  }

  /* ---------------- 提子特效:爆炸烈焰 ---------------- */

  function makeBoom(cell) {
    const embers = [];
    const N = 18;
    for (let i = 0; i < N; i++) {
      embers.push({
        ang: Math.random() * Math.PI * 2,
        v: cell * (1.2 + Math.random() * 2.0),
        g: cell * 3.2,
        delay: Math.random() * 0.1,
        life: 0.6 + Math.random() * 0.35,
        phase: Math.random() * Math.PI * 2
      });
    }
    const smoke = [];
    for (let i = 0; i < 6; i++) {
      smoke.push({
        ang: Math.random() * Math.PI * 2,
        dist: cell * (0.4 + Math.random() * 0.8),
        size: cell * (0.3 + Math.random() * 0.3),
        rise: cell * (0.4 + Math.random() * 0.5),
        delay: 0.08 + Math.random() * 0.2,
        life: 0.55 + Math.random() * 0.3,
        alpha: 0.22 + Math.random() * 0.12
      });
    }
    return { embers, smoke };
  }

  function drawBoom(ctx, a, p) {
    const { x, y, cell } = a;
    const durS = a.dur / 1000;

    /* 白熱爆心 */
    if (p < 0.14) {
      const f = p / 0.14;
      const g = ctx.createRadialGradient(
        x, y, cell * 0.02, x, y, cell * (0.35 + 0.55 * f)
      );
      g.addColorStop(0, `rgba(255,252,235,${0.95 * (1 - f)})`);
      g.addColorStop(0.5, `rgba(255,190,90,${0.7 * (1 - f)})`);
      g.addColorStop(1, 'rgba(255,90,30,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, cell * (0.35 + 0.55 * f), 0, Math.PI * 2);
      ctx.fill();
    }

    /* 爆震環 */
    const rf = (p - 0.02) / 0.5;
    if (rf > 0 && rf < 1) {
      const rq = easeOut(rf);
      ctx.strokeStyle = `rgba(255,150,60,${0.7 * (1 - rf)})`;
      ctx.lineWidth = Math.max(1.2, cell * 0.11 * (1 - rf * 0.7));
      ctx.beginPath();
      ctx.arc(x, y, cell * (0.3 + 1.9 * rq), 0, Math.PI * 2);
      ctx.stroke();
    }

    /* 火星(重力拋物線 + 明滅) */
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const s of a.embers) {
      const f = (p - s.delay) / s.life;
      if (f <= 0 || f >= 1) continue;
      const tt = f * s.life * durS;
      const d = s.v * tt;
      const droop = 0.5 * s.g * tt * tt;
      const hx = x + Math.cos(s.ang) * d;
      const hy = y + Math.sin(s.ang) * d * 0.85 + droop;
      const flicker = 0.7 + 0.3 * Math.sin(f * 30 + s.phase);
      const al = (1 - f) * flicker;
      ctx.strokeStyle = `rgba(255,120,40,${0.85 * al})`;
      ctx.lineWidth = Math.max(1, cell * 0.075 * (1 - f * 0.55));
      ctx.beginPath();
      ctx.moveTo(
        x + Math.cos(s.ang) * d * 0.55,
        y + Math.sin(s.ang) * d * 0.47
      );
      ctx.lineTo(hx, hy);
      ctx.stroke();
      ctx.fillStyle = `rgba(255,210,120,${al})`;
      ctx.beginPath();
      ctx.arc(hx, hy, Math.max(1, cell * 0.06 * (1 - f * 0.5)), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    /* 熱煙 */
    for (const s of a.smoke) {
      const f = (p - s.delay) / s.life;
      if (f <= 0 || f >= 1) continue;
      const fq = easeOut(f);
      const wx = x + Math.cos(s.ang) * s.dist * fq;
      const wy = y + Math.sin(s.ang) * s.dist * 0.6 * fq - s.rise * fq;
      const r = s.size * (0.5 + fq);
      const env = f < 0.2 ? f / 0.2 : 1 - (f - 0.2) / 0.8;
      const sg = ctx.createRadialGradient(wx, wy, r * 0.1, wx, wy, r);
      sg.addColorStop(0, `rgba(255,205,160,${s.alpha * env})`);
      sg.addColorStop(1, 'rgba(255,205,160,0)');
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(wx, wy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ---------------- 提子特效:碎裂飛散 ---------------- */

  function makeShatter(cell) {
    const shards = [];
    const N = 12;
    for (let i = 0; i < N; i++) {
      shards.push({
        ang: (i / N) * Math.PI * 2 + (Math.random() - 0.5) * 0.5,
        dist: cell * (0.7 + Math.random() * 1.1),
        size: cell * (0.1 + Math.random() * 0.09),
        rot: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 7,
        delay: Math.random() * 0.08,
        life: 0.65 + Math.random() * 0.3
      });
    }
    return { shards };
  }

  function drawShatter(ctx, a, p) {
    const { x, y, cell, color } = a;
    const durS = a.dur / 1000;

    /* 碎裂白光與裂紋 */
    if (p < 0.1) {
      const f = p / 0.1;
      ctx.strokeStyle = `rgba(255,255,255,${0.8 * (1 - f)})`;
      ctx.lineWidth = Math.max(1, cell * 0.05);
      for (let k = 0; k < 5; k++) {
        const ang = (k / 5) * Math.PI * 2 + 0.4;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(ang) * cell * 0.1, y + Math.sin(ang) * cell * 0.1);
        ctx.lineTo(
          x + Math.cos(ang) * cell * (0.3 + 0.3 * f),
          y + Math.sin(ang) * cell * (0.3 + 0.3 * f)
        );
        ctx.stroke();
      }
    }

    const dark = color === 1;
    for (const s of a.shards) {
      const f = (p - s.delay) / s.life;
      if (f <= 0 || f >= 1) continue;
      const fq = easeOut(f);
      const tt = f * s.life * durS;
      const d = s.dist * fq;
      const droop = 0.5 * (cell * 2.6) * tt * tt;
      const wx = x + Math.cos(s.ang) * d;
      const wy = y + Math.sin(s.ang) * d * 0.9 + droop;
      const al = f < 0.75 ? 1 : 1 - (f - 0.75) / 0.25;
      ctx.save();
      ctx.translate(wx, wy);
      ctx.rotate(s.rot + s.spin * f);
      const g = ctx.createLinearGradient(-s.size, -s.size, s.size, s.size);
      if (dark) {
        g.addColorStop(0, `rgba(90,98,110,${al})`);
        g.addColorStop(1, `rgba(18,21,26,${al})`);
      } else {
        g.addColorStop(0, `rgba(255,255,255,${al})`);
        g.addColorStop(1, `rgba(190,192,198,${al})`);
      }
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-s.size, -s.size * 0.35);
      ctx.lineTo(s.size * 0.55, -s.size * 0.8);
      ctx.lineTo(s.size, s.size * 0.45);
      ctx.lineTo(-s.size * 0.45, s.size * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  /* ---------------- 提子特效:灰飛煙滅 ---------------- */

  function makeAsh(cell) {
    const motes = [];
    const N = 14;
    for (let i = 0; i < N; i++) {
      motes.push({
        ang: Math.random() * Math.PI * 2,
        r0: cell * (0.08 + Math.random() * 0.3),
        drift: cell * (0.15 + Math.random() * 0.35),
        rise: cell * (0.7 + Math.random() * 0.9),
        size: cell * (0.06 + Math.random() * 0.07),
        wobA: cell * (0.05 + Math.random() * 0.08),
        wobF: 1.5 + Math.random() * 2.2,
        phase: Math.random() * Math.PI * 2,
        delay: Math.random() * 0.25,
        life: 0.55 + Math.random() * 0.35,
        alpha: 0.35 + Math.random() * 0.25,
        lite: Math.random() < 0.4
      });
    }
    return { motes };
  }

  function drawAsh(ctx, a, p) {
    const { x, y, cell, color } = a;
    const dark = color === 1;

    /* 棋子殘影:漸淡消失 */
    if (p < 0.28) {
      const f = p / 0.28;
      ctx.fillStyle = dark
        ? `rgba(20,24,30,${0.85 * (1 - f)})`
        : `rgba(242,242,244,${0.9 * (1 - f)})`;
      ctx.beginPath();
      ctx.arc(x, y, cell * 0.46 * (1 - 0.25 * f), 0, Math.PI * 2);
      ctx.fill();
    }

    /* 灰燼搖曳升起 */
    for (const s of a.motes) {
      const f = (p - s.delay) / s.life;
      if (f <= 0 || f >= 1) continue;
      const wob = Math.sin(s.phase + f * s.wobF * Math.PI);
      const wx = x + Math.cos(s.ang) * (s.r0 + s.drift * f) + wob * s.wobA;
      const wy = y - s.rise * easeOut(f) * (0.6 + 0.4 * Math.sin(s.phase));
      const env = f < 0.2 ? f / 0.2 : 1 - (f - 0.2) / 0.8;
      const base = s.lite ? '170,172,180' : '104,104,112';
      ctx.fillStyle = `rgba(${base},${s.alpha * env})`;
      ctx.beginPath();
      ctx.arc(wx, wy, Math.max(0.5, s.size * (1 - 0.4 * f)), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ---------------- 提子特效:星塵四散 ---------------- */

  function makeDust(cell) {
    const motes = [];
    const N = 14;
    const palette = [
      '255,224,130',
      '170,225,255',
      '225,180,255',
      '255,255,255'
    ];
    for (let i = 0; i < N; i++) {
      motes.push({
        ang: Math.random() * Math.PI * 2,
        dist: cell * (0.5 + Math.random() * 1.2),
        size: cell * (0.08 + Math.random() * 0.07),
        spin: (Math.random() - 0.5) * 6,
        delay: Math.random() * 0.2,
        life: 0.55 + Math.random() * 0.35,
        phase: Math.random() * Math.PI * 2,
        c: palette[i % palette.length]
      });
    }
    return { motes };
  }

  function drawDust(ctx, a, p) {
    const { x, y, cell } = a;

    /* 星光爆點 */
    if (p < 0.15) {
      const f = p / 0.15;
      const g = ctx.createRadialGradient(
        x, y, cell * 0.02, x, y, cell * (0.3 + 0.8 * f)
      );
      g.addColorStop(0, `rgba(255,255,255,${0.6 * (1 - f)})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, cell * (0.3 + 0.8 * f), 0, Math.PI * 2);
      ctx.fill();
    }

    for (const s of a.motes) {
      const f = (p - s.delay) / s.life;
      if (f <= 0 || f >= 1) continue;
      const fq = easeOut(f);
      const d = s.dist * fq;
      const wx = x + Math.cos(s.ang) * d;
      const wy = y + Math.sin(s.ang) * d * 0.9;
      const tw = 0.5 + 0.5 * Math.sin(f * 22 + s.phase);
      const al = (1 - f) * (0.5 + 0.5 * tw);
      const r = s.size * (0.7 + 0.5 * tw);
      ctx.fillStyle = `rgba(${s.c},${al})`;
      starPath(ctx, wx, wy, r, s.phase + s.spin * f);
      ctx.fill();
    }
  }

  /* ---------------- 特效註冊表 ---------------- */
  const EFFECTS = {
    qi:     { dur: 1600, thumbP: 0.3,  make: cell => ({ puffs: makePuffs(cell) }),  draw: drawQi },
    math:   { dur: 1600, thumbP: 0.32, make: cell => ({ glyphs: makeGlyphs(cell) }), draw: drawMath },
    spark:  { dur: 1100, thumbP: 0.3,  make: makeSparks,  draw: drawSpark },
    ripple: { dur: 1900, thumbP: 0.42, make: makeRings,   draw: drawRipple },
    petal:  { dur: 2200, thumbP: 0.42, make: makePetals,  draw: drawPetal },
    bolt:   { dur: 750,  thumbP: 0.12, make: makeBolts,   draw: drawBolt },
    boom:    { dur: 900,  thumbP: 0.32, make: makeBoom,    draw: drawBoom },
    shatter: { dur: 1000, thumbP: 0.4,  make: makeShatter, draw: drawShatter },
    ash:     { dur: 1500, thumbP: 0.45, make: makeAsh,     draw: drawAsh },
    dust:    { dur: 1200, thumbP: 0.4,  make: makeDust,    draw: drawDust }
  };

  /* ---------------- 主迴圈 ---------------- */

  function spawn(t, type, x, y, cell, color) {
    const def = EFFECTS[type];
    if (!def) return;
    t.anims.push({
      type,
      born: performance.now(),
      dur: def.dur,
      x, y, cell, color,
      ...def.make(cell)
    });
    if (!rafId) rafId = requestAnimationFrame(frame);
  }

  function frame(now) {
    rafId = 0;
    let alive = false;

    for (const t of targets) {
      const hasMarker = !!t.marker;
      if (!t.anims.length && !hasMarker) continue;

      const size = syncToDisplay(t);
      if (!size) {
        /* 棋盤已隱藏(如中途返回大廳):
           丟棄動畫並清空畫布,避免凍結的畫格
           殘留在覆蓋層上蓋住之後的棋局 */
        t.anims.length = 0;
        t.ctx.setTransform(1, 0, 0, 1, 0, 0);
        t.ctx.clearRect(0, 0, t.canvas.width, t.canvas.height);
        continue;
      }

      t.ctx.setTransform(1, 0, 0, 1, 0, 0);
      t.ctx.clearRect(0, 0, t.canvas.width, t.canvas.height);
      t.ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);

      if (t.bg) t.bg(t.ctx, size.w, size.h);

      if (t.marker) drawMarker(t.ctx, t.marker, now);

      for (let i = t.anims.length - 1; i >= 0; i--) {
        const a = t.anims[i];
        const p = (now - a.born) / a.dur;
        if (p >= 1) {
          t.anims.splice(i, 1);
          continue;
        }
        EFFECTS[a.type]?.draw(t.ctx, a, p);
      }

      if (t.anims.length || hasMarker) {
        alive = true;
      } else if (!t.bg) {
        t.ctx.setTransform(1, 0, 0, 1, 0, 0);
        t.ctx.clearRect(0, 0, t.canvas.width, t.canvas.height);
      }
    }

    if (alive) rafId = requestAnimationFrame(frame);
  }

  /* ---------------- 對外 API ---------------- */

  /* 棋盤覆蓋層:落子特效入口 */
  function ensureOverlay() {
    if (overlay) return targetFor(overlay);
    const board = document.getElementById('boardCanvas');
    if (!board || !board.parentNode) return null;
    overlay = document.createElement('canvas');
    overlay.id = 'fxCanvas';
    board.parentNode.insertBefore(overlay, board.nextSibling);
    return targetFor(overlay);
  }

  function stone(x, y, color) {
    const mode =
      (window.GoSettings && window.GoSettings.get().fx) || 'none';
    if (mode === 'none') return;

    const t = ensureOverlay();
    if (!t) return;

    const pt =
      window.GoBoard &&
      window.GoBoard.boardPoint &&
      window.GoBoard.boardPoint(x, y);
    if (!pt || !pt.cell) return;

    spawn(t, mode, pt.x, pt.y, pt.cell, color);
  }

  /* 提子特效入口:在每顆被提棋子的位置播放 */
  function capture(x, y, color) {
    const mode =
      (window.GoSettings && window.GoSettings.get().cap) || 'none';
    if (mode === 'none') return;

    const t = ensureOverlay();
    if (!t) return;

    const pt =
      window.GoBoard &&
      window.GoBoard.boardPoint &&
      window.GoBoard.boardPoint(x, y);
    if (!pt || !pt.cell) return;

    spawn(t, mode, pt.x, pt.y, pt.cell, color);
  }

  /* 衣櫥大預覽:在指定 canvas 播放一次(背景為木紋示範盤) */
  function playOnCanvas(canvas, mode) {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const t = targetFor(canvas);
    if (!t) return;

    const cell = Math.min(rect.width, rect.height) * 0.32;
    const cx = rect.width * 0.5;
    const cy = rect.height * 0.62;

    t.bg = (ctx, w, h) => {
      paintWoodScene(ctx, w, h, cell);
    };

    if (mode === 'none' || !EFFECTS[mode]) {
      /* 無特效:呈現靜態示範盤 */
      t.anims.length = 0;
      const size = syncToDisplay(t);
      if (size) {
        t.ctx.setTransform(1, 0, 0, 1, 0, 0);
        t.ctx.clearRect(0, 0, t.canvas.width, t.canvas.height);
        t.ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
        t.bg(t.ctx, size.w, size.h);
      }
      return;
    }

    /* 預覽重播:先清掉上一輪動畫,畫面才乾淨 */
    t.anims.length = 0;
    spawn(t, mode, cx, cy, cell, 1);
  }

  /* 衣櫥縮圖:靜態定格 */
  function renderThumb(canvas, mode) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const cell = h * 0.62;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);

    paintWoodScene(ctx, w, h, cell);

    const def = EFFECTS[mode];
    if (def) {
      def.draw(
        ctx,
        { x: w * 0.5, y: h * 0.62, cell, dur: def.dur, ...def.make(cell) },
        def.thumbP
      );
    }
  }

  /* ---------------- 最後一手標記 ---------------- */

  /* ring 由棋盤 canvas 自繪(靜態);
     pulse / blink / spin 由覆蓋層逐格驅動 */
  function setMarker(style, lastMove) {
    const t = ensureOverlay();
    if (!t) return;

    if (!lastMove || style === 'ring') {
      if (t.marker) {
        t.marker = null;
        if (!t.anims.length) {
          const size = syncToDisplay(t);
          if (size) {
            t.ctx.setTransform(1, 0, 0, 1, 0, 0);
            t.ctx.clearRect(0, 0, t.canvas.width, t.canvas.height);
          }
        }
      }
      return;
    }

    const pt =
      window.GoBoard &&
      window.GoBoard.boardPoint &&
      window.GoBoard.boardPoint(lastMove.x, lastMove.y);
    if (!pt || !pt.cell) return;

    /* 保留 born:換手時呼吸/旋轉相位不跳動 */
    if (t.marker) {
      t.marker.style = style;
      t.marker.x = pt.x;
      t.marker.y = pt.y;
      t.marker.cell = pt.cell;
    } else {
      t.marker = {
        style,
        x: pt.x,
        y: pt.y,
        cell: pt.cell,
        born: performance.now()
      };
    }

    if (!rafId) rafId = requestAnimationFrame(frame);
  }

  /* 衣櫥預覽:在指定 canvas 逐格顯示標記(木紋示範盤) */
  function previewMarker(canvas, style) {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const t = targetFor(canvas);
    if (!t) return;

    const cell = Math.min(rect.width, rect.height) * 0.32;
    const cx = rect.width * 0.5;
    const cy = rect.height * 0.62;

    t.bg = (ctx, w, h) => {
      paintWoodScene(ctx, w, h, cell);
    };

    if (t.marker && t.marker.style === style) {
      t.marker.x = cx;
      t.marker.y = cy;
      t.marker.cell = cell;
    } else {
      t.marker = {
        style,
        x: cx,
        y: cy,
        cell,
        born: performance.now()
      };
    }

    if (!rafId) rafId = requestAnimationFrame(frame);
  }

  function stopMarkerPreview(canvas) {
    const t = targets.find(o => o.canvas === canvas);
    if (!t || !t.marker) return;
    t.marker = null;
    const size = syncToDisplay(t);
    if (size) {
      t.ctx.setTransform(1, 0, 0, 1, 0, 0);
      t.ctx.clearRect(0, 0, t.canvas.width, t.canvas.height);
      t.ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
      if (t.bg) t.bg(t.ctx, size.w, size.h);
    }
  }

  /* 衣櫥縮圖:靜態定格(挑各樣式明顯的相位) */
  function renderMarkerThumb(canvas, style) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const cell = h * 0.62;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);

    paintWoodScene(ctx, w, h, cell);

    const phase = {
      ring: 0, pulse: 463, blink: 287, spin: 300,
      stars: 200, planet: 350, tornado: 180
    }[style] || 0;
    drawMarker(
      ctx,
      { style, x: w * 0.5, y: h * 0.62, cell, born: performance.now() - phase },
      performance.now()
    );
  }

  window.GoFX = {
    stone,
    capture,
    playOnCanvas,
    renderThumb,
    setMarker,
    previewMarker,
    stopMarkerPreview,
    renderMarkerThumb
  };
})();
