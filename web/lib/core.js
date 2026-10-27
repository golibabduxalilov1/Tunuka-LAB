// @ts-nocheck
/* Yadro: hisob-kitob, raskroy, DXF. Brauzer va DOM ga bogʻliq emas. */
/* =====================================================================
   YADRO: kesim → yoyilma → listga joylash → DXF. DOM ga bogʻliq emas.
   ===================================================================== */
const Core = (function () {
'use strict';
const D2R = Math.PI / 180;
class GenError extends Error { constructor(m) { super(m); this.name = 'GenError'; } }
const sum = a => a.reduce((s, v) => s + v, 0);

/** Sonni chiroyli formatlash */
function fmt(v, d = 2) {
  if (v === null || v === undefined || !isFinite(v)) return '—';
  let s = (+v).toFixed(d);
  if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
  if (s === '-0') s = '0';
  return s;
}
/** Kiritishni tekshirib songa aylantirish (xato boʻlsa aniq xabar) */
function num(v, name, o = {}) {
  const x = typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.').trim());
  if (v === '' || v === null || v === undefined || !isFinite(x)) throw new GenError(`${name}: son kiriting`);
  if (o.gt !== undefined && !(x > o.gt)) throw new GenError(`${name} ${o.gt} dan katta boʻlishi kerak (hozir: ${x})`);
  if (o.min !== undefined && x < o.min) throw new GenError(`${name} ${o.min} dan kichik boʻlmasin (hozir: ${x})`);
  if (o.max !== undefined && x > o.max) throw new GenError(`${name} ${o.max} dan katta boʻlmasin (hozir: ${x})`);
  if (o.int && !Number.isInteger(x)) throw new GenError(`${name} butun son boʻlsin (hozir: ${x})`);
  return x;
}

const MATERIALS = {
  galv: { name: 'Rux qoplamali (otsinkovka)', density: 7850 },
  pol: { name: 'Rangli (polimer) otsinkovka', density: 7850 },
  al: { name: 'Alyuminiy', density: 2700 },
  cu: { name: 'Mis', density: 8900 },
  aisi: { name: 'Zanglamaydigan poʻlat', density: 7900 }
};

function bendCalc(T, R, angAbs, K) {
  const A = angAbs * D2R, BA = A * (R + K * T), OSSB = Math.tan(A / 2) * (R + T);
  return { angAbs, A, BA, OSSB, BD: 2 * OSSB - BA };
}

/* ---------------- Kesim (segmentlar zanjiri) → yoyilma ---------------- */
const DIRS = { R: 0, UR: 45, U: 90, UL: 135, L: 180, DL: 225, D: 270, DR: 315 };
const ARROW = { R: '→', UR: '↗', U: '↑', UL: '↖', L: '←', DL: '↙', D: '↓', DR: '↘' };
const normTurn = t => ((t % 360) + 540) % 360 - 180;
const normAng = a => ((a % 360) + 360) % 360;
const hasAng = s => s.ang !== undefined && s.ang !== null && s.ang !== '';
/** Segment yoʻnalishi (gradus): ixtiyoriy burchak `ang` yoki 8 ta asosiy yoʻnalishdan biri `dir` */
function segDir(s) {
  if (hasAng(s)) { const a = Number(String(s.ang).replace(',', '.')); return isFinite(a) ? normAng(a) : undefined; }
  return DIRS[s.dir];
}

/** Har bir qator uchun oldingi yoʻnalishga nisbatan burilish (zavaltsovkani aniqlash uchun) */
function rowTurns(segs) {
  let cur = null;
  return (segs || []).map(s => {
    if (s.t === 'arc') { if (cur === null) return null; const a = +s.a || 0; cur += s.side === 'R' ? -a : a; return null; }
    const a = segDir(s); if (a === undefined) return null;
    const t = cur === null ? null : normTurn(a - cur); cur = a; return t;
  });
}

/**
 * Kesim yoyilmasi.
 * Oddiy yigʻindi (tunuka standarti): eni = Σ segmentlar + Σ yoy uzunliklari.
 * K-faktor: segmentlar tashqi oʻlcham, har bukishda −BD (= 2·OSSB − BA).
 */
function computeProfile(it, P) {
  const f = P.unit === 'sm' ? 10 : 1, U = P.unit === 'sm' ? 'sm' : 'mm';
  const T = num(P.T, 'Qalinlik', { gt: 0, max: 5 });
  const segs = Array.isArray(it.segs) ? it.segs : [];
  const nmOf = i => it.names ? it.names[i] : `${i + 1}-segment`;
  if (!segs.length) throw new GenError('Kamida bitta segment kiriting');
  const els = []; let cur = null;
  segs.forEach((s, i) => {
    const nm = nmOf(i);
    if (s.t === 'arc') {
      if (cur === null) throw new GenError(`${nm}: kesim toʻgʻri segment bilan boshlanishi kerak (yoydan oldin)`);
      const r = num(s.r, `${nm} radiusi`, { gt: 0 }) * f, a = num(s.a, `${nm} burchagi`, { gt: 0, max: 180 });
      const ang = s.side === 'R' ? -a : a;
      els.push({ t: 'arc', r, ang, len: r * a * D2R, seg: i, rows: [i] }); cur += ang; return;
    }
    const Lv = num(s.L, `${nm} uzunligi`, { gt: 0 }) * f, a = segDir(s);
    if (a === undefined) throw new GenError(`${nm}: yoʻnalish tanlanmagan`);
    if (cur === null) { els.push({ t: 'line', L: Lv, dir: a, seg: i, rows: [i] }); cur = a; return; }
    let t = normTurn(a - cur);
    if (Math.abs(t) < 1e-9) {
      const last = els[els.length - 1];
      if (last.t === 'line') { last.L += Lv; last.rows.push(i); }
      else els.push({ t: 'line', L: Lv, dir: a, seg: i, rows: [i] });
      cur = a; return;
    }
    if (Math.abs(Math.abs(t) - 180) < 1e-9) t = s.side === 'R' ? -180 : 180;
    els.push({ t: 'bend', turn: t, seg: i }); els.push({ t: 'line', L: Lv, dir: a, seg: i, rows: [i] }); cur = a;
  });
  const kmode = P.calc === 'k';
  let R = 0, K = 0;
  if (kmode) { R = num(P.R, 'Ichki radius R', { min: 0, max: 50 }); K = num(P.K, 'K-faktor', { min: 0, max: 1 }); }
  const warns = [], rows = [];
  els.forEach(e => {
    if (e.t !== 'bend') return;
    const a = Math.abs(e.turn);
    if (kmode) {
      if (a > 170) throw new GenError(`${nmOf(e.seg)} dagi ${fmt(a)}° bukish (zavaltsovka) K-faktor rejimida hisoblanmaydi — «Oddiy yigʻindi» rejimini tanlang`);
      const bc = bendCalc(T, R, a, K); e.BA = bc.BA; e.sb = bc.OSSB; e.bc = bc;
    } else { e.BA = 0; e.sb = 0; }
  });
  els.forEach((e, i) => {
    if (e.t !== 'line') return;
    const pb = els[i - 1], nb = els[i + 1];
    e.st = e.L - (pb && pb.t === 'bend' ? pb.sb : 0) - (nb && nb.t === 'bend' ? nb.sb : 0);
    if (e.st < -1e-9) throw new GenError(`${nmOf(e.seg)} (${fmt(e.L / f)} ${U}) bukish uchun juda qisqa`);
    if (e.L < 5 - 1e-9 && !it.noWarn) warns.push(`${nmOf(e.seg)} ${fmt(e.L)} mm — juda kalta, listogibda bukish qiyin`);
  });
  let y = 0; const lines = [];
  els.forEach(e => {
    if (e.t === 'line') { e.y0 = y; y += Math.max(0, e.st); e.y1 = y; }
    else if (e.t === 'bend') { e.y0 = y; y += e.BA; e.y1 = y; e.y = (e.y0 + e.y1) / 2; lines.push({ y: e.y, turn: e.turn, kind: Math.abs(e.turn) >= 180 ? 'hem' : 'bend', seg: e.seg }); }
    else { e.y0 = y; y += e.len; e.y1 = y; lines.push({ y: e.y0, turn: e.ang, kind: 'arc', r: e.r, seg: e.seg }); lines.push({ y: e.y1, turn: e.ang, kind: 'arc', r: e.r, seg: e.seg }); }
  });
  const W = y;
  if (!(W > 0)) throw new GenError('Yoyilma nolga teng');
  const nb = els.filter(e => e.t === 'bend').length, na = els.filter(e => e.t === 'arc').length;
  if (!kmode) {
    rows.push(`= ${els.filter(e => e.t !== 'bend').map(e => e.t === 'line' ? fmt(e.L, 2) : `π·${fmt(e.r, 2)}·${fmt(Math.abs(e.ang))}/180`).join(' + ')}`);
    rows.push(`= ${fmt(W, 3)} mm   (${nb} bukish${na ? `, ${na} yoy` : ''})`);
  } else {
    els.filter(e => e.t === 'bend').forEach((e, i) => rows.push(`B${i + 1} ${fmt(Math.abs(e.turn))}°: BA = π·A/180·(R+K·T) = ${fmt(e.BA, 4)};  OSSB = tan(A/2)·(R+T) = ${fmt(e.sb, 4)};  BD = ${fmt(e.bc.BD, 4)}`));
    rows.push(`= Σ L − Σ BD${na ? ' + Σ yoy' : ''} = ${fmt(sum(els.filter(e => e.t === 'line').map(e => e.L)), 3)} − ${fmt(sum(els.filter(e => e.t === 'bend').map(e => e.bc.BD)), 4)}${na ? ' + ' + fmt(sum(els.filter(e => e.t === 'arc').map(e => e.len)), 3) : ''} = ${fmt(W, 3)} mm`);
  }
  // chizma uchun polilyniya (oʻlchamlar boʻyicha)
  let p = [0, 0], d = null; const pts = [[0, 0]], labels = [], hv = Math.max(2, T * 4);
  els.forEach(e => {
    if (e.t === 'line') {
      d = e.dir; const u = [Math.cos(d * D2R), Math.sin(d * D2R)];
      e.rows.forEach(ri => { const Lr = (+segs[ri].L) * f, q = [p[0] + u[0] * Lr, p[1] + u[1] * Lr]; labels.push({ x: (p[0] + q[0]) / 2, y: (p[1] + q[1]) / 2, n: [-u[1], u[0]], txt: fmt(+segs[ri].L, 2), seg: ri }); pts.push(q); p = q; });
    }
    else if (e.t === 'bend') { if (Math.abs(e.turn) >= 180) { const u = [Math.cos(d * D2R), Math.sin(d * D2R)], sg = Math.sign(e.turn); p = [p[0] - u[1] * hv * sg, p[1] + u[0] * hv * sg]; pts.push(p); } }
    else {
      const sg = Math.sign(e.ang), u = [Math.cos(d * D2R), Math.sin(d * D2R)], c = [p[0] - u[1] * e.r * sg, p[1] + u[0] * e.r * sg], th0 = Math.atan2(p[1] - c[1], p[0] - c[0]), steps = Math.max(4, Math.ceil(Math.abs(e.ang) / 8));
      for (let k = 1; k <= steps; k++) { const th = th0 + e.ang * D2R * k / steps; pts.push([c[0] + e.r * Math.cos(th), c[1] + e.r * Math.sin(th)]); }
      const mid = pts[pts.length - 1 - Math.floor(steps / 2)]; labels.push({ x: mid[0], y: mid[1], n: [(mid[0] - c[0]) / e.r, (mid[1] - c[1]) / e.r], txt: `R${fmt(e.r / f)}`, seg: e.seg });
      p = pts[pts.length - 1]; d += e.ang;
    }
  });
  return { els, W, lines, rows, warns, pts, labels, T, f, unit: U, kmode, R };
}

/* ---------------- Taglik + tomonlar (2 yoki 4 tomon) ---------------- */
const FLIPV = { R: 'R', L: 'L', U: 'D', D: 'U', UR: 'DR', DR: 'UR', UL: 'DL', DL: 'UL' };
/**
 * Tomon profili lokal koordinatada beriladi: taglikdan tashqariga → , yuqoriga ↑.
 * Qarama-qarshi tomonga qoʻyish uchun ko‘zgu + teskari tartib (uchidan taglikka qarab).
 */
function mirrorSide(segs) {
  const n = segs.length;
  const out = segs.slice().reverse().map(s => s.t === 'arc' ? { t: 'arc', side: s.side, a: s.a, r: s.r } : hasAng(s) ? { ang: normAng(360 - segDir(s)), L: s.L } : { dir: FLIPV[s.dir], L: s.L });
  segs.forEach((s, i) => { if (s.t !== 'arc' && s.side && i >= 1) out[n - i].side = s.side; });
  return { segs: out, baseSide: segs[0] && segs[0].t !== 'arc' ? segs[0].side : undefined };
}
/** Chap tomon + taglik + oʻng tomon = toʻliq kesim zanjiri */
function crossChain(leftSegs, base, rightSegs, nmL, nmR) {
  const m = mirrorSide(leftSegs), b = { dir: 'R', L: base };
  if (m.baseSide) b.side = m.baseSide;
  const segs = [...m.segs, b, ...rightSegs.map(s => Object.assign({}, s))];
  const names = [...m.segs.map((_, i) => `${nmL} ${m.segs.length - i}-segment`), 'Taglik', ...rightSegs.map((_, i) => `${nmR} ${i + 1}-segment`)];
  return { segs, names, baseIdx: m.segs.length };
}
/** Taglikning yoyilmadagi chegaralari (unga yondosh bukish chiziqlari) */
function baseBounds(pr, baseIdx) {
  const i = pr.els.findIndex(e => e.t === 'line' && e.rows.includes(baseIdx)), e = pr.els[i], pb = pr.els[i - 1], nb = pr.els[i + 1];
  return [e.y0 - (pb && pb.t === 'bend' ? pb.BA / 2 : 0), e.y1 + (nb && nb.t === 'bend' ? nb.BA / 2 : 0)];
}
const SIDE_MODES = {
  '2s': '2 tomon — ikkalasi bir xil', '2d': '2 tomon — har xil',
  '4s': '4 tomon — hammasi bir xil', '4p': '4 tomon — qarama-qarshilari juft', '4d': '4 tomon — har biri har xil'
};
/** Rejimga qarab har bir tomon uchun segmentlar */
function sidesFor(it) {
  const s = it.sides || {}, g = k => Array.isArray(s[k]) ? s[k] : [];
  switch (it.sideMode) {
    case '2s': return { R: g('R'), L: g('R') };
    case '2d': return { R: g('R'), L: g('L') };
    case '4s': return { R: g('R'), L: g('R'), T: g('R'), B: g('R') };
    case '4p': return { R: g('R'), L: g('R'), T: g('T'), B: g('T') };
    default: return { R: g('R'), L: g('L'), T: g('T'), B: g('B') };
  }
}
/** Koʻpburchakdan takror va bir chiziqdagi nuqtalarni olib tashlash */
function simplify(pts) {
  let a = pts.slice(), ch = true;
  while (ch && a.length > 3) {
    ch = false;
    for (let i = 0; i < a.length; i++) {
      const p = a[(i - 1 + a.length) % a.length], q = a[i], r = a[(i + 1) % a.length];
      const cr = (q[0] - p[0]) * (r[1] - q[1]) - (q[1] - p[1]) * (r[0] - q[0]);
      if (Math.hypot(q[0] - p[0], q[1] - p[1]) < 1e-9 || Math.abs(cr) < 1e-9) { a.splice(i, 1); ch = true; break; }
    }
  }
  return a;
}
const polyArea = pts => Math.abs(sum(pts.map((p, i) => { const q = pts[(i + 1) % pts.length]; return p[0] * q[1] - q[0] * p[1]; }))) / 2;
const polyPerim = pts => sum(pts.map((p, i) => { const q = pts[(i + 1) % pts.length]; return Math.hypot(q[0] - p[0], q[1] - p[1]); }));

/**
 * Detal → yassi yoyilma.
 * Lokal koordinata: X — rulon boʻylab (uzunlik), Y — rulon eni boʻylab.
 * outline = null boʻlsa toʻrtburchak X×Y; aks holda koʻpburchak (4 tomonli, burchaklari kesilgan).
 */
function buildPart(it, P) {
  const f = P.unit === 'sm' ? 10 : 1;
  if (it.type !== 'tray') {
    const pr = computeProfile(it, P), X = num(it.len, 'Uzunligi (mm)', { gt: 0 });
    return { kind: 'profile', X, Y: pr.W, outline: null, prW: pr, bends: pr.lines.map(l => ({ a: [0, l.y], b: [X, l.y], l })), area: X * pr.W, rows: ['Kesim yoyilmasi:', ...pr.rows], warns: pr.warns };
  }
  if (!SIDE_MODES[it.sideMode]) throw new GenError('Tomonlar rejimi tanlanmagan');
  const S = sidesFor(it), B = num(it.base, 'Taglik eni', { gt: 0 });
  const cw = crossChain(S.L, B, S.R, 'Chap', 'Oʻng'), prW = computeProfile({ segs: cw.segs, names: cw.names }, P), [y0, y1] = baseBounds(prW, cw.baseIdx);
  if (it.sideMode[0] === '2') {
    const X = num(it.len, 'Uzunligi (mm)', { gt: 0 });
    return { kind: 'tray2', X, Y: prW.W, outline: null, prW, bends: prW.lines.map(l => ({ a: [0, l.y], b: [X, l.y], l })), area: X * prW.W, rows: ['Kesim (chap + taglik + oʻng):', ...prW.rows], warns: prW.warns };
  }
  const Lb = num(it.baseL, 'Taglik boʻyi', { gt: 0 });
  const cl = crossChain(S.B, Lb, S.T, 'Past', 'Yuqori'), prL = computeProfile({ segs: cl.segs, names: cl.names }, P), [x0, x1] = baseBounds(prL, cl.baseIdx);
  const X = prL.W, Y = prW.W;
  let outline = simplify([[x0, 0], [x1, 0], [x1, y0], [X, y0], [X, y1], [x1, y1], [x1, Y], [x0, Y], [x0, y1], [0, y1], [0, y0], [x0, y0]]);
  if (outline.length === 4) outline = null;
  const bends = [...prW.lines.map(l => ({ a: [x0, l.y], b: [x1, l.y], l })), ...prL.lines.map(l => ({ a: [l.y, y0], b: [l.y, y1], l }))];
  const area = outline ? polyArea(outline) : X * Y;
  const rows = [
    `Eni yoʻnalishi (chap + taglik ${fmt(B)} ${prW.unit} + oʻng):`, ...prW.rows,
    `Boʻyi yoʻnalishi (past + taglik ${fmt(Lb)} ${prW.unit} + yuqori):`, ...prL.rows,
    `Yoyilma gabariti: ${fmt(X, 2)} × ${fmt(Y, 2)} mm; taglik ${fmt(x1 - x0, 2)} × ${fmt(y1 - y0, 2)} mm`,
    outline ? `Burchaklar kesiladi: ${fmt(x0, 1)}×${fmt(y0, 1)}, ${fmt(X - x1, 1)}×${fmt(y0, 1)}, ${fmt(x0, 1)}×${fmt(Y - y1, 1)}, ${fmt(X - x1, 1)}×${fmt(Y - y1, 1)} mm` : 'Burchak kesimi yoʻq'
  ];
  return { kind: 'tray4', X, Y, outline, prW, prL, x0, x1, y0, y1, bends, area, rows, warns: [...prW.warns, ...prL.warns], sides: S };
}

/* ---------------- Bir chiziqli shrift (faqat LINE) ---------------- */
const FONT = {
  A: '0,0 0,4 2,6 4,4 4,0|0,3 4,3', B: '0,0 0,6 3,6 4,5 4,4 3,3 0,3|3,3 4,2 4,1 3,0 0,0', C: '4,1 3,0 1,0 0,1 0,5 1,6 3,6 4,5', D: '0,0 0,6 3,6 4,5 4,1 3,0 0,0', E: '4,0 0,0 0,6 4,6|0,3 3,3', F: '0,0 0,6 4,6|0,3 3,3',
  G: '4,5 3,6 1,6 0,5 0,1 1,0 3,0 4,1 4,3 2,3', H: '0,0 0,6|4,0 4,6|0,3 4,3', I: '1,0 3,0|2,0 2,6|1,6 3,6', J: '0,1 1,0 3,0 4,1 4,6', K: '0,0 0,6|4,6 0,2|1,3 4,0', L: '0,6 0,0 4,0', M: '0,0 0,6 2,3 4,6 4,0',
  N: '0,0 0,6 4,0 4,6', O: '1,0 0,1 0,5 1,6 3,6 4,5 4,1 3,0 1,0', P: '0,0 0,6 3,6 4,5 4,4 3,3 0,3', Q: '1,0 0,1 0,5 1,6 3,6 4,5 4,1 3,0 1,0|2,2 4,0', R: '0,0 0,6 3,6 4,5 4,4 3,3 0,3|2,3 4,0',
  S: '4,5 3,6 1,6 0,5 0,4 1,3 3,3 4,2 4,1 3,0 1,0 0,1', T: '0,6 4,6|2,6 2,0', U: '0,6 0,1 1,0 3,0 4,1 4,6', V: '0,6 2,0 4,6', W: '0,6 1,0 2,3 3,0 4,6', X: '0,0 4,6|0,6 4,0', Y: '0,6 2,3 4,6|2,3 2,0', Z: '0,6 4,6 0,0 4,0',
  '0': '1,0 0,1 0,5 1,6 3,6 4,5 4,1 3,0 1,0|0,1 4,5', '1': '1,5 2,6 2,0|1,0 3,0', '2': '0,5 1,6 3,6 4,5 4,4 0,0 4,0', '3': '0,5 1,6 3,6 4,5 4,4 3,3 1,3|3,3 4,2 4,1 3,0 1,0 0,1', '4': '3,0 3,6 0,2 4,2',
  '5': '4,6 0,6 0,3 3,3 4,2 4,1 3,0 0,0', '6': '4,5 3,6 1,6 0,5 0,1 1,0 3,0 4,1 4,2 3,3 0,3', '7': '0,6 4,6 1,0', '8': '1,3 0,4 0,5 1,6 3,6 4,5 4,4 3,3 1,3 0,2 0,1 1,0 3,0 4,1 4,2 3,3', '9': '0,1 1,0 3,0 4,1 4,5 3,6 1,6 0,5 0,4 1,3 4,3',
  '-': '1,3 3,3', '.': '1.6,0 2.4,0', ':': '1.6,1 2.4,1|1.6,4 2.4,4', '/': '0,0 4,6', '+': '2,1 2,5|0,3 4,3', '=': '0,2 4,2|0,4 4,4', '#': '1,0 1,6|3,0 3,6|0,2 4,2|0,4 4,4', '(': '3,6 1,4 1,2 3,0', ')': '1,6 3,4 3,2 1,0', '_': '0,0 4,0', "'": '2,6 2,4.5', '?': '0,5 1,6 3,6 4,5 4,4 2,3 2,2|1.6,0 2.4,0'
};
function textStrokes(str, x, y, h, opt = {}) {
  const s = h / 6, adv = 5.5 * s, txt = String(str).toUpperCase().replace(/[ʻʼ‘’`]/g, "'");
  const W = txt.length * adv - 1.5 * s, x0 = opt.align === 'center' ? x - W / 2 : x, out = [];
  [...txt].forEach((ch, i) => {
    if (ch === ' ') return;
    (FONT[ch] || FONT['?']).split('|').forEach(st => {
      const pts = st.trim().split(/\s+/).map(q => q.split(',').map(Number));
      for (let k = 0; k + 1 < pts.length; k++) out.push([[x0 + i * adv + pts[k][0] * s, y + pts[k][1] * s], [x0 + i * adv + pts[k + 1][0] * s, y + pts[k + 1][1] * s]]);
    });
  });
  return out;
}
const textWidth = (str, h) => String(str).length * 5.5 * h / 6 - 1.5 * h / 6;

/* ---------------- DXF yozuvchi (R12 / AutoCAD 2000) ---------------- */
const LAYERS = [['0', 7], ['CUT', 1], ['BEND', 3], ['LABEL', 7], ['SHEET', 8]];
function dxfWriter(ver, prec) {
  const R12 = ver === 'AC1009';
  let hnd = 0x40; const nh = () => (hnd++).toString(16).toUpperCase();
  const body = [], used = new Set(['0', 'CUT']), ext = [Infinity, Infinity, -Infinity, -Infinity];
  const f = v => { let s = (Math.abs(v) < 1e-12 ? 0 : v).toFixed(prec); if (s.indexOf('.') >= 0) { s = s.replace(/0+$/, ''); if (s.endsWith('.')) s += '0'; } if (s === '-0.0') s = '0.0'; return s; };
  const pt = (x, y) => { ext[0] = Math.min(ext[0], x); ext[1] = Math.min(ext[1], y); ext[2] = Math.max(ext[2], x); ext[3] = Math.max(ext[3], y); };
  const G = (arr, code, val) => { arr.push(String(code).padStart(3, ' '), String(val)); };
  const head = (type, layer, subcls) => { used.add(layer); const a = []; G(a, 0, type); if (!R12) { G(a, 5, nh()); G(a, 330, '1F'); G(a, 100, 'AcDbEntity'); } G(a, 8, layer); if (!R12 && subcls) G(a, 100, subcls); return a; };
  return {
    line(layer, p, q) { const a = head('LINE', layer, 'AcDbLine'); G(a, 10, f(p[0])); G(a, 20, f(p[1])); G(a, 30, '0.0'); G(a, 11, f(q[0])); G(a, 21, f(q[1])); G(a, 31, '0.0'); body.push(a.join('\n')); pt(p[0], p[1]); pt(q[0], q[1]); },
    poly(layer, verts) {
      verts.forEach(v => pt(v[0], v[1]));
      if (R12) {
        used.add(layer); const a = []; G(a, 0, 'POLYLINE'); G(a, 8, layer); G(a, 66, 1); G(a, 10, '0.0'); G(a, 20, '0.0'); G(a, 30, '0.0'); G(a, 70, 1);
        verts.forEach(v => { G(a, 0, 'VERTEX'); G(a, 8, layer); G(a, 10, f(v[0])); G(a, 20, f(v[1])); G(a, 30, '0.0'); });
        G(a, 0, 'SEQEND'); G(a, 8, layer); body.push(a.join('\n'));
      } else {
        const a = head('LWPOLYLINE', layer, 'AcDbPolyline'); G(a, 90, verts.length); G(a, 70, 1); G(a, 43, '0.0');
        verts.forEach(v => { G(a, 10, f(v[0])); G(a, 20, f(v[1])); }); body.push(a.join('\n'));
      }
    },
    build() {
      if (!isFinite(ext[0])) { ext[0] = ext[1] = 0; ext[2] = ext[3] = 1; }
      const L = [], g = (c, v) => G(L, c, v);
      const layers = LAYERS.filter(l => used.has(l[0]));
      if (R12) {
        g(0, 'SECTION'); g(2, 'HEADER'); g(9, '$ACADVER'); g(1, 'AC1009'); g(9, '$INSBASE'); g(10, '0.0'); g(20, '0.0'); g(30, '0.0');
        g(9, '$EXTMIN'); g(10, f(ext[0])); g(20, f(ext[1])); g(30, '0.0'); g(9, '$EXTMAX'); g(10, f(ext[2])); g(20, f(ext[3])); g(30, '0.0'); g(9, '$INSUNITS'); g(70, 4); g(0, 'ENDSEC');
        g(0, 'SECTION'); g(2, 'TABLES');
        g(0, 'TABLE'); g(2, 'LTYPE'); g(70, 1); g(0, 'LTYPE'); g(2, 'CONTINUOUS'); g(70, 0); g(3, 'Solid line'); g(72, 65); g(73, 0); g(40, '0.0'); g(0, 'ENDTAB');
        g(0, 'TABLE'); g(2, 'LAYER'); g(70, layers.length); layers.forEach(([n, c]) => { g(0, 'LAYER'); g(2, n); g(70, 0); g(62, c); g(6, 'CONTINUOUS'); }); g(0, 'ENDTAB');
        g(0, 'TABLE'); g(2, 'STYLE'); g(70, 1); g(0, 'STYLE'); g(2, 'STANDARD'); g(70, 0); g(40, '0.0'); g(41, '1.0'); g(50, '0.0'); g(71, 0); g(42, '2.5'); g(3, 'txt'); g(4, ''); g(0, 'ENDTAB');
        g(0, 'ENDSEC'); g(0, 'SECTION'); g(2, 'BLOCKS'); g(0, 'ENDSEC'); g(0, 'SECTION'); g(2, 'ENTITIES');
        return L.join('\n') + (body.length ? '\n' + body.join('\n') : '') + '\n  0\nENDSEC\n  0\nEOF\n';
      }
      const layerRecs = layers.map(([n, c]) => ({ n, c, h: n === '0' ? '10' : nh() })), seed = nh();
      g(0, 'SECTION'); g(2, 'HEADER'); g(9, '$ACADVER'); g(1, 'AC1015'); g(9, '$DWGCODEPAGE'); g(3, 'ANSI_1252');
      g(9, '$INSBASE'); g(10, '0.0'); g(20, '0.0'); g(30, '0.0'); g(9, '$EXTMIN'); g(10, f(ext[0])); g(20, f(ext[1])); g(30, '0.0'); g(9, '$EXTMAX'); g(10, f(ext[2])); g(20, f(ext[3])); g(30, '0.0');
      g(9, '$LIMMIN'); g(10, '0.0'); g(20, '0.0'); g(9, '$LIMMAX'); g(10, f(Math.max(ext[2], 1))); g(20, f(Math.max(ext[3], 1)));
      g(9, '$LUNITS'); g(70, 2); g(9, '$INSUNITS'); g(70, 4); g(9, '$MEASUREMENT'); g(70, 1); g(9, '$HANDSEED'); g(5, seed); g(0, 'ENDSEC');
      g(0, 'SECTION'); g(2, 'CLASSES'); g(0, 'ENDSEC'); g(0, 'SECTION'); g(2, 'TABLES');
      const tbl = (name, h, n) => { g(0, 'TABLE'); g(2, name); g(5, h); g(330, '0'); g(100, 'AcDbSymbolTable'); g(70, n); };
      const rec = (type, h, owner, sub) => { g(0, type); g(5, h); g(330, owner); g(100, 'AcDbSymbolTableRecord'); g(100, sub); };
      tbl('VPORT', '8', 1); rec('VPORT', '29', '8', 'AcDbViewportTableRecord'); g(2, '*ACTIVE'); g(70, 0);
      const cx = (ext[0] + ext[2]) / 2, cy = (ext[1] + ext[3]) / 2, vh = Math.max(ext[3] - ext[1], (ext[2] - ext[0]) / 1.5, 1) * 1.1;
      [[10, '0.0'], [20, '0.0'], [11, '1.0'], [21, '1.0'], [12, f(cx)], [22, f(cy)], [13, '0.0'], [23, '0.0'], [14, '10.0'], [24, '10.0'], [15, '10.0'], [25, '10.0'], [16, '0.0'], [26, '0.0'], [36, '1.0'], [17, '0.0'], [27, '0.0'], [37, '0.0'], [40, f(vh)], [41, '1.5'], [42, '50.0'], [43, '0.0'], [44, '0.0'], [50, '0.0'], [51, '0.0'], [71, 0], [72, 100], [73, 1], [74, 3], [75, 0], [76, 0], [77, 0], [78, 0]].forEach(([c, v]) => g(c, v));
      g(0, 'ENDTAB');
      tbl('LTYPE', '5', 3);
      rec('LTYPE', '14', '5', 'AcDbLinetypeTableRecord'); g(2, 'ByBlock'); g(70, 0); g(3, ''); g(72, 65); g(73, 0); g(40, '0.0');
      rec('LTYPE', '15', '5', 'AcDbLinetypeTableRecord'); g(2, 'ByLayer'); g(70, 0); g(3, ''); g(72, 65); g(73, 0); g(40, '0.0');
      rec('LTYPE', '16', '5', 'AcDbLinetypeTableRecord'); g(2, 'Continuous'); g(70, 0); g(3, 'Solid line'); g(72, 65); g(73, 0); g(40, '0.0');
      g(0, 'ENDTAB');
      tbl('LAYER', '2', layerRecs.length); layerRecs.forEach(l => { rec('LAYER', l.h, '2', 'AcDbLayerTableRecord'); g(2, l.n); g(70, 0); g(62, l.c); g(6, 'Continuous'); g(370, -3); }); g(0, 'ENDTAB');
      tbl('STYLE', '3', 1); rec('STYLE', '11', '3', 'AcDbTextStyleTableRecord'); g(2, 'Standard'); g(70, 0); g(40, '0.0'); g(41, '1.0'); g(50, '0.0'); g(71, 0); g(42, '2.5'); g(3, 'txt'); g(4, ''); g(0, 'ENDTAB');
      tbl('VIEW', '6', 0); g(0, 'ENDTAB'); tbl('UCS', '7', 0); g(0, 'ENDTAB');
      tbl('APPID', '9', 1); rec('APPID', '12', '9', 'AcDbRegAppTableRecord'); g(2, 'ACAD'); g(70, 0); g(0, 'ENDTAB');
      g(0, 'TABLE'); g(2, 'DIMSTYLE'); g(5, 'A'); g(330, '0'); g(100, 'AcDbSymbolTable'); g(70, 1); g(100, 'AcDbDimStyleTable'); g(71, 0);
      g(0, 'DIMSTYLE'); g(105, '27'); g(330, 'A'); g(100, 'AcDbSymbolTableRecord'); g(100, 'AcDbDimStyleTableRecord'); g(2, 'Standard'); g(70, 0); g(0, 'ENDTAB');
      tbl('BLOCK_RECORD', '1', 2); rec('BLOCK_RECORD', '1F', '1', 'AcDbBlockTableRecord'); g(2, '*Model_Space'); rec('BLOCK_RECORD', '1B', '1', 'AcDbBlockTableRecord'); g(2, '*Paper_Space'); g(0, 'ENDTAB');
      g(0, 'ENDSEC'); g(0, 'SECTION'); g(2, 'BLOCKS');
      g(0, 'BLOCK'); g(5, '20'); g(330, '1F'); g(100, 'AcDbEntity'); g(8, '0'); g(100, 'AcDbBlockBegin'); g(2, '*Model_Space'); g(70, 0); g(10, '0.0'); g(20, '0.0'); g(30, '0.0'); g(3, '*Model_Space'); g(1, '');
      g(0, 'ENDBLK'); g(5, '21'); g(330, '1F'); g(100, 'AcDbEntity'); g(8, '0'); g(100, 'AcDbBlockEnd');
      g(0, 'BLOCK'); g(5, '1C'); g(330, '1B'); g(100, 'AcDbEntity'); g(67, 1); g(8, '0'); g(100, 'AcDbBlockBegin'); g(2, '*Paper_Space'); g(70, 0); g(10, '0.0'); g(20, '0.0'); g(30, '0.0'); g(3, '*Paper_Space'); g(1, '');
      g(0, 'ENDBLK'); g(5, '1D'); g(330, '1B'); g(100, 'AcDbEntity'); g(67, 1); g(8, '0'); g(100, 'AcDbBlockEnd');
      g(0, 'ENDSEC'); g(0, 'SECTION'); g(2, 'ENTITIES');
      const T2 = [], g2 = (c, v) => G(T2, c, v);
      g2(0, 'ENDSEC'); g2(0, 'SECTION'); g2(2, 'OBJECTS');
      g2(0, 'DICTIONARY'); g2(5, 'C'); g2(330, '0'); g2(100, 'AcDbDictionary'); g2(281, 1); g2(3, 'ACAD_GROUP'); g2(350, 'D');
      g2(0, 'DICTIONARY'); g2(5, 'D'); g2(330, 'C'); g2(100, 'AcDbDictionary'); g2(281, 1); g2(0, 'ENDSEC'); g2(0, 'EOF');
      return L.join('\n') + (body.length ? '\n' + body.join('\n') : '') + '\n' + T2.join('\n') + '\n';
    }
  };
}
/** Primitivlar: {k:'poly', layer, pts} (yopiq) | {k:'line', layer, a, b} */
function dxfFromPrims(prims, o) {
  const w = dxfWriter(o.ver || 'AC1015', o.prec ?? 3);
  prims.forEach(p => {
    if (p.k === 'line') w.line(p.layer, p.a, p.b);
    else if (o.rectAsLines) p.pts.forEach((q, i) => w.line(p.layer, q, p.pts[(i + 1) % p.pts.length]));
    else w.poly(p.layer, p.pts);
  });
  return w.build();
}

/* ---------------- DXF oʻquvchi va tekshiruv (qayta oʻqish) ---------------- */
function parseDXF(txt) {
  const ln = String(txt).split(/\r?\n/); if (ln.length && ln[ln.length - 1] === '') ln.pop();
  const R = { sections: [], eof: false, ver: null, insunits: null, layers: {}, ents: [], errors: [], lines: ln.length };
  if (ln.length % 2) R.errors.push('Qatorlar soni toq — kod/qiymat juftligi buzilgan');
  let sec = null, expectName = false, hv = null, cur = null, poly = null, vtx = null, lay = null;
  const flush = () => { if (cur) R.ents.push(cur); cur = null; };
  for (let i = 0; i + 1 < ln.length; i += 2) {
    const code = parseInt(ln[i].trim(), 10), v = ln[i + 1].trim();
    if (isNaN(code)) { R.errors.push(`${i + 1}-qator: guruh kodi notoʻgʻri`); continue; }
    if (expectName) { if (code === 2) { sec = v; R.sections.push(v); } expectName = false; continue; }
    if (code === 0) {
      if (lay) { R.layers[lay.name] = lay; lay = null; }
      if (v === 'SECTION') { flush(); expectName = true; continue; }
      if (v === 'ENDSEC') { flush(); if (poly) { R.errors.push('POLYLINE SEQEND siz tugagan'); poly = null; } sec = null; continue; }
      if (v === 'EOF') { flush(); R.eof = true; continue; }
      if (sec === 'TABLES' && v === 'LAYER') { lay = { name: '', color: 7 }; continue; }
      if (sec === 'ENTITIES') {
        if (poly && v === 'VERTEX') { vtx = { x: 0, y: 0 }; poly.verts.push(vtx); continue; }
        if (poly && v === 'SEQEND') { R.ents.push(poly); poly = null; vtx = null; continue; }
        flush();
        if (v === 'POLYLINE') { poly = { type: 'POLYLINE', layer: '0', verts: [], flags: 0 }; vtx = null; continue; }
        cur = { type: v, layer: '0', verts: [], flags: 0 };
      }
      continue;
    }
    if (sec === 'HEADER') { if (code === 9) hv = v; else if (hv === '$ACADVER' && code === 1) R.ver = v; else if (hv === '$INSUNITS' && code === 70) R.insunits = +v; continue; }
    if (lay) { if (code === 2) lay.name = v; else if (code === 62) lay.color = +v; continue; }
    if (sec !== 'ENTITIES') continue;
    if (poly) { if (vtx) { if (code === 10) vtx.x = +v; else if (code === 20) vtx.y = +v; } else if (code === 8) poly.layer = v; else if (code === 70) poly.flags = +v; continue; }
    if (!cur) continue;
    const isLW = cur.type === 'LWPOLYLINE', lv = cur.verts[cur.verts.length - 1];
    switch (code) {
      case 8: cur.layer = v; break;
      case 10: if (isLW) cur.verts.push({ x: +v, y: 0 }); else cur.x = +v; break;
      case 20: if (isLW) { if (lv) lv.y = +v; } else cur.y = +v; break;
      case 11: cur.x2 = +v; break; case 21: cur.y2 = +v; break;
      case 70: cur.flags = +v; break;
    }
  }
  if (lay) R.layers[lay.name] = lay;
  return R;
}
/** Tekshiruv: ruxsat etilmagan obyekt, nol uzunlik, ustma-ust chiziq, ochiq kontur, birlik */
function validateDXF(R, o = {}) {
  const iss = [], E = m => iss.push({ lv: 'err', msg: m });
  if (!R.sections.includes('ENTITIES')) E('ENTITIES boʻlimi yoʻq');
  if (!R.eof) E('Fayl oxirida EOF yoʻq');
  if (R.insunits !== 4) E(`$INSUNITS = ${R.insunits} (4 = mm boʻlishi kerak)`);
  R.errors.forEach(E);
  const allowed = new Set(['LINE', 'LWPOLYLINE', 'POLYLINE']);
  const segs = [], ends = new Map(), kp = (x, y) => Math.round(x * 1000) + ',' + Math.round(y * 1000);
  const addEnd = k => ends.set(k, (ends.get(k) || 0) + 1);
  R.ents.forEach(e => {
    if (!allowed.has(e.type)) { E(`Ruxsat etilmagan obyekt: ${e.type} (${e.layer})`); return; }
    const cut = e.layer === 'CUT';
    if (e.type === 'LINE') {
      if (Math.hypot(e.x2 - e.x, e.y2 - e.y) < 1e-6) E(`Nol uzunlikdagi LINE (${e.layer})`);
      if (cut) { segs.push([e.x, e.y, e.x2, e.y2]); addEnd(kp(e.x, e.y)); addEnd(kp(e.x2, e.y2)); }
    } else {
      const v = e.verts;
      if (v.length < 3) E(`Notoʻgʻri ${e.type} (${e.layer}): ${v.length} ta nuqta`);
      if (cut && (e.flags & 1) !== 1) E(`Ochiq ${e.type} (${e.layer}) — kontur yopilmagan`);
      for (let i = 0; i < v.length; i++) { const a = v[i], b = v[(i + 1) % v.length]; if (Math.hypot(b.x - a.x, b.y - a.y) < 1e-6) E(`${e.type} ichida nol segment`); if (cut) segs.push([a.x, a.y, b.x, b.y]); }
    }
  });
  const H = new Map(), V = new Map(), r3 = v => Math.round(v * 1000) / 1000;
  segs.forEach(([x1, y1, x2, y2]) => {
    if (Math.abs(y1 - y2) < 1e-6) { const k = r3(y1); (H.get(k) || H.set(k, []).get(k)).push([Math.min(x1, x2), Math.max(x1, x2)]); }
    else if (Math.abs(x1 - x2) < 1e-6) { const k = r3(x1); (V.get(k) || V.set(k, []).get(k)).push([Math.min(y1, y2), Math.max(y1, y2)]); }
  });
  let ovl = 0;
  [[H, 'y'], [V, 'x']].forEach(([M, ax]) => M.forEach((iv, k) => { iv.sort((a, b) => a[0] - b[0]); let e = -Infinity; for (let i = 0; i < iv.length; i++) { if (iv[i][0] < e - 1e-3) { ovl++; if (ovl <= 5) E(`Ustma-ust kesish chizigʻi (${ax} = ${fmt(k, 3)}, ${fmt(iv[i][0], 1)}…${fmt(Math.min(iv[i][1], e), 1)}) — ikki marta kesiladi`); } e = Math.max(e, iv[i][1]); } }));
  if (!o.openOk) { let open = 0; ends.forEach((n, k) => { if (n % 2) { open++; if (open <= 5) E(`Ochiq kontur uchi (${k.split(',').map(s => fmt(+s / 1000, 3)).join(', ')})`); } }); }
  return { issues: iss, ok: !iss.length };
}

/* ---------------- Listga joylash ---------------- */
/** Erkin toʻrtburchaklar; ball: eng kichik oʻng chegara (rulon uzunligini tejash), keyin pastroq */
class StripBin {
  constructor(W, H) { this.W = W; this.H = H; this.free = [{ x: 0, y: 0, w: W, h: H }]; this.pl = []; }
  find(it, gap) {
    let best = null;
    for (const rot of it.rots) {
      const w = (rot ? it.h : it.w) + gap, h = (rot ? it.w : it.h) + gap;
      for (const f of this.free) if (w <= f.w + 1e-9 && h <= f.h + 1e-9) {
        const s1 = f.x + w, s2 = f.y;
        if (!best || s1 < best.s1 - 1e-9 || (Math.abs(s1 - best.s1) <= 1e-9 && s2 < best.s2 - 1e-9)) best = { x: f.x, y: f.y, w, h, rot, s1, s2 };
      }
    }
    return best;
  }
  place(b, it) {
    const r = b, nf = [];
    for (const f of this.free) {
      if (r.x >= f.x + f.w - 1e-9 || r.x + r.w <= f.x + 1e-9 || r.y >= f.y + f.h - 1e-9 || r.y + r.h <= f.y + 1e-9) { nf.push(f); continue; }
      if (r.x > f.x + 1e-9) nf.push({ x: f.x, y: f.y, w: r.x - f.x, h: f.h });
      if (r.x + r.w < f.x + f.w - 1e-9) nf.push({ x: r.x + r.w, y: f.y, w: f.x + f.w - (r.x + r.w), h: f.h });
      if (r.y > f.y + 1e-9) nf.push({ x: f.x, y: f.y, w: f.w, h: r.y - f.y });
      if (r.y + r.h < f.y + f.h - 1e-9) nf.push({ x: f.x, y: r.y + r.h, w: f.w, h: f.y + f.h - (r.y + r.h) });
    }
    nf.sort((a, c) => c.w * c.h - a.w * a.h);
    const kept = [];
    for (const q of nf) if (!kept.some(k => q.x >= k.x - 1e-9 && q.y >= k.y - 1e-9 && q.x + q.w <= k.x + k.w + 1e-9 && q.y + q.h <= k.y + k.h + 1e-9)) kept.push(q);
    this.free = kept; this.pl.push({ it, x: b.x, y: b.y, rot: b.rot });
  }
}
/** Toʻrtburchaklar qirralarini birlashtirish (umumiy chiziq): har chiziq bir marta */
function mergeEdges(rects) {
  const H = new Map(), V = new Map(), k = v => Math.round(v * 1e6) / 1e6;
  const add = (M, key, a, b) => { (M.get(key) || M.set(key, []).get(key)).push([a, b]); };
  rects.forEach(r => { add(H, k(r.y), r.x, r.x + r.w); add(H, k(r.y + r.h), r.x, r.x + r.w); add(V, k(r.x), r.y, r.y + r.h); add(V, k(r.x + r.w), r.y, r.y + r.h); });
  const out = [];
  const merge = (M, horiz) => [...M.keys()].sort((a, b) => a - b).forEach(key => {
    const iv = M.get(key).sort((a, b) => a[0] - b[0]); let [s, e] = iv[0];
    for (let i = 1; i <= iv.length; i++) {
      if (i < iv.length && iv[i][0] <= e + 1e-6) { e = Math.max(e, iv[i][1]); continue; }
      out.push(horiz ? { a: [s, key], b: [e, key] } : { a: [key, s], b: [key, e] });
      if (i < iv.length) [s, e] = iv[i];
    }
  });
  merge(H, true); merge(V, false);
  return out;
}
/** Joylashgan detal uchun lokal → list koordinata funksiyasi */
const placeFn = q => q.rot ? p => [q.x + q.s.Y - p[1], q.y + p[0]] : p => [q.x + p[0], q.y + p[1]];
/**
 * Raskroy. parts: [{id, name, X, Y, outline, bends, area, qty}]
 * N: {sheetW, maxLen, margin, gap, rotate, commonLine}
 */
function nestStrips(parts, N) {
  const m = num(N.margin, 'Chekka', { min: 0 }), cl = !!N.commonLine, gap = cl ? 0 : num(N.gap, 'Oraliq', { min: 0 });
  const SW = num(N.sheetW, 'List eni', { gt: 0 }), ML = num(N.maxLen, 'Maks. uzunlik', { gt: 0 });
  const pg = Math.max(+N.gap || 0, 3);
  if (SW - 2 * m <= 0 || ML - 2 * m <= 0) throw new GenError('Chekka list oʻlchamidan katta');
  const Wx = ML - 2 * m + gap, Hy = SW - 2 * m + gap, items = [], unplaced = [];
  parts.forEach(s => {
    if (!(s.qty > 0)) return;
    const pad = cl && s.outline ? pg : 0, fw = s.X + 2 * pad, fh = s.Y + 2 * pad;
    const rots = [false, true].filter(r => (!r || N.rotate) && (r ? fh : fw) + gap <= Wx + 1e-9 && (r ? fw : fh) + gap <= Hy + 1e-9);
    if (!rots.length) {
      const why = Math.min(s.X, s.Y) > SW - 2 * m ? `ikkala oʻlcham ham list ishchi enidan (${fmt(SW - 2 * m)} mm) katta` : s.Y > SW - 2 * m && !N.rotate ? `yoyilma eni ${fmt(s.Y, 1)} mm > list ishchi eni ${fmt(SW - 2 * m)} mm («90° burish»ni yoqib koʻring)` : `uzunlik ${fmt(Math.max(s.X, s.Y), 1)} mm > maks. ${fmt(ML - 2 * m)} mm`;
      unplaced.push({ s, n: s.qty, reason: why }); return;
    }
    for (let i = 0; i < s.qty; i++) items.push({ s, w: fw, h: fh, pad, rots });
  });
  items.sort((a, b) => b.w - a.w || b.h - a.h);
  const bins = [];
  for (const it of items) {
    let done = false;
    for (const b of bins) { const p = b.find(it, gap); if (p) { b.place(p, it); done = true; break; } }
    if (!done) { const b = new StripBin(Wx, Hy), p = b.find(it, gap); if (p) { b.place(p, it); bins.push(b); } else unplaced.push({ s: it.s, n: 1, reason: 'joylashtirib boʻlmadi' }); }
  }
  const sheets = bins.map((b, i) => {
    const pl = b.pl.map(q => ({ s: q.it.s, rot: q.rot, pad: q.it.pad, x: m + q.x + q.it.pad, y: m + q.y + q.it.pad, w: q.rot ? q.it.s.Y : q.it.s.X, h: q.rot ? q.it.s.X : q.it.s.Y }))
      .sort((a, c) => a.x - c.x || a.y - c.y);
    const xmax = Math.max(...pl.map(q => q.x + q.w + q.pad)), usedLen = Math.min(ML, Math.ceil(xmax + m - 1e-9));
    const area = sum(pl.map(q => q.s.area)), sheetArea = usedLen * SW;
    const sh = { index: i + 1, SW, ML, margin: m, gap, usedLen, placements: pl, count: pl.length, area, util: area / sheetArea * 100, waste: sheetArea - area };
    const rects = pl.filter(q => !q.s.outline), polys = pl.filter(q => q.s.outline);
    sh.cut = cl ? mergeEdges(rects) : null;
    sh.cutLen = (cl ? sum(sh.cut.map(l => Math.hypot(l.b[0] - l.a[0], l.b[1] - l.a[1]))) : sum(rects.map(q => 2 * (q.w + q.h)))) + sum(polys.map(q => polyPerim(q.s.outline)));
    sh.pierces = (cl ? sh.cut.length : rects.length) + polys.length;
    sh.verify = verifySheet(sh);
    return sh;
  });
  return { sheets, unplaced, gap };
}
/** Detallar kesishmaydi (gabarit boʻyicha), oraliq saqlanadi, list ichida */
function verifySheet(sh) {
  const errs = [], P = sh.placements.slice().sort((a, b) => a.x - b.x), g = sh.gap - 1e-6;
  P.forEach(p => { if (p.x < sh.margin - 1e-6 || p.y < sh.margin - 1e-6 || p.x + p.w > sh.ML - sh.margin + 1e-6 || p.y + p.h > sh.SW - sh.margin + 1e-6) errs.push(`${p.s.id} list chegarasidan chiqqan`); });
  for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
    const a = P[i], b = P[j]; if (b.x - (a.x + a.w) >= g) break;
    const dx = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w)), dy = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h));
    if (Math.max(dx, dy) < g) errs.push(`${a.s.id} va ${b.s.id} orasi ${fmt(Math.max(dx, dy), 3)} mm < ${fmt(sh.gap, 3)} mm`);
  }
  return errs;
}
/** Bitta detal primitivlari (q — joylashuv; noRect — kontur umumiy chiziqlar bilan beriladi) */
function partPrims(q, o, noRect) {
  const s = q.s, f = placeFn(q), prims = [];
  if (!noRect) prims.push({ k: 'poly', layer: 'CUT', pts: (s.outline || [[0, 0], [s.X, 0], [s.X, s.Y], [0, s.Y]]).map(f) });
  if (o.bendLayer) s.bends.forEach(b => prims.push({ k: 'line', layer: 'BEND', a: f(b.a), b: f(b.b) }));
  if (o.labelLayer) {
    const txt = `${s.id} ${fmt(s.Y, 1)}X${fmt(s.X, 0)}`, cx = s.outline ? (s.x0 + s.x1) / 2 : s.X / 2, cy = s.outline ? (s.y0 + s.y1) / 2 : s.Y / 2, room = s.outline ? Math.min(s.x1 - s.x0, s.y1 - s.y0) : Math.min(s.X, s.Y);
    let hh = Math.max(2, Math.min(room / 6, 25)); const tw = textWidth(txt, hh), lim = (s.outline ? s.x1 - s.x0 : s.X) * 0.8; if (tw > lim) hh = Math.max(1, hh * lim / tw);
    textStrokes(txt, cx, cy - hh / 2, hh, { align: 'center' }).forEach(z => prims.push({ k: 'line', layer: 'LABEL', a: f(z[0]), b: f(z[1]) }));
  }
  return prims;
}
function sheetPrims(sh, o) {
  const prims = [];
  if (o.sheetLayer) prims.push({ k: 'poly', layer: 'SHEET', pts: [[0, 0], [sh.usedLen, 0], [sh.usedLen, sh.SW], [0, sh.SW]] });
  if (sh.cut) sh.cut.forEach(l => prims.push({ k: 'line', layer: 'CUT', a: l.a, b: l.b }));
  sh.placements.forEach(q => prims.push(...partPrims(q, o, !!sh.cut && !q.s.outline)));
  return prims;
}
/** Yakka detal DXF (0,0 dan) */
function singlePrims(s, o) { return partPrims({ s, x: 0, y: 0, rot: false }, o, false); }

/* ---------------- Oʻz-oʻzini tekshirish ---------------- */
function selfTest() {
  const R = [], ok = (name, pass, detail) => R.push({ name, pass: !!pass, detail });
  const base = { unit: 'mm', T: 0.5, calc: 'sum', R: 0.5, K: 0.33 };
  const gapSegs = [{ dir: 'D', L: 20 }, { dir: 'L', L: 20 }, { dir: 'D', L: 20 }, { dir: 'R', L: 100 }, { dir: 'U', L: 20 }, { dir: 'L', L: 20 }, { dir: 'U', L: 20 }];
  const gap = computeProfile({ segs: gapSegs }, base);
  ok('GAP (erkin kesim): 20+20+20+100+20+20+20 = 220 mm, 6 bukish', Math.abs(gap.W - 220) < 1e-9 && gap.lines.length === 6, `Dastur: ${fmt(gap.W, 4)} mm; bukishlar y = ${gap.lines.map(l => fmt(l.y)).join(', ')}`);
  const tr = buildPart({ type: 'tray', sideMode: '2s', base: 100, len: 2000, sides: { R: [{ dir: 'U', L: 20 }, { dir: 'L', L: 20 }, { dir: 'U', L: 20 }] } }, base);
  const same = tr.prW.lines.length === 6 && tr.prW.lines.every((l, i) => Math.abs(l.y - gap.lines[i].y) < 1e-9 && Math.sign(l.turn) === Math.sign(gap.lines[i].turn));
  ok('GAP (taglik 100 + 2 tomon bir xil ↑20 ←20 ↑20) = erkin kesim bilan bir xil', Math.abs(tr.Y - 220) < 1e-9 && same, `Yoyilma ${fmt(tr.Y, 3)} mm, bukishlar va yoʻnalishlar mos: ${same ? 'ha' : 'yoʻq'}`);
  const gapSm = computeProfile({ segs: gapSegs.map(s => ({ dir: s.dir, L: s.L / 10 })) }, Object.assign({}, base, { unit: 'sm' }));
  ok('Birlik: sm → mm', Math.abs(gapSm.W - 220) < 1e-9, `2,2,2,10,2,2,2 sm → ${fmt(gapSm.W, 4)} mm`);
  const asym = buildPart({ type: 'tray', sideMode: '2d', base: 100, len: 1000, sides: { R: [{ dir: 'U', L: 20 }], L: [{ dir: 'U', L: 30 }, { dir: 'L', L: 10 }] } }, base);
  ok('2 tomon har xil: 30+10 | 100 | 20 = 160 mm', Math.abs(asym.Y - 160) < 1e-9 && asym.prW.lines.map(l => fmt(l.y)).join(',') === '10,40,140', `Dastur: ${fmt(asym.Y, 3)} mm, bukishlar: ${asym.prW.lines.map(l => fmt(l.y)).join(', ')}`);
  const kas = buildPart({ type: 'tray', sideMode: '4s', base: 300, baseL: 500, sides: { R: [{ dir: 'U', L: 30 }, { dir: 'R', L: 10 }] } }, base);
  const expA = 580 * 380 - 4 * 40 * 40;
  ok('Kasseta 4 tomon bir xil: 500×300, tomon ↑30 →10 → 580×380, burchak 40×40', Math.abs(kas.X - 580) < 1e-9 && Math.abs(kas.Y - 380) < 1e-9 && kas.outline.length === 12 && Math.abs(kas.area - expA) < 1e-6 && kas.bends.length === 8, `Gabarit ${fmt(kas.X)}×${fmt(kas.Y)}, uchlar ${kas.outline.length}, yuza ${fmt(kas.area)} (kutilgan ${expA}), bukish chiziqlari ${kas.bends.length}`);
  const d4 = buildPart({ type: 'tray', sideMode: '4d', base: 200, baseL: 400, sides: { R: [{ dir: 'U', L: 40 }], L: [{ dir: 'U', L: 20 }], T: [{ dir: 'U', L: 25 }, { dir: 'L', L: 10 }], B: [] } }, base);
  ok('4 tomon har xil (biri yoʻq): 400+0+35 × 200+20+40', Math.abs(d4.X - 435) < 1e-9 && Math.abs(d4.Y - 260) < 1e-9 && d4.outline && d4.outline.length === 8, `Gabarit ${fmt(d4.X)}×${fmt(d4.Y)}, uchlar ${d4.outline ? d4.outline.length : 4}`);
  const angP = buildPart({ type: 'tray', sideMode: '2s', base: 100, len: 2000, sides: { R: [{ ang: 90, L: 20 }, { ang: 180, L: 20 }, { ang: 90, L: 20 }] } }, base);
  const angSame = angP.prW.lines.length === 6 && angP.prW.lines.every((l, i) => Math.abs(l.y - gap.lines[i].y) < 1e-9 && Math.sign(l.turn) === Math.sign(gap.lines[i].turn));
  ok('Chizilgan burchaklar (ang 90/180/90) = yoʻnalishli GAP', Math.abs(angP.Y - 220) < 1e-9 && angSame, `Yoyilma ${fmt(angP.Y, 3)} mm, bukishlar mos: ${angSame ? 'ha' : 'yoʻq'}`);
  const hem = computeProfile({ segs: [{ dir: 'R', L: 100 }, { dir: 'L', L: 10, side: 'L' }] }, base);
  ok('Zavaltsovka (180°): 100 + 10 = 110 mm', Math.abs(hem.W - 110) < 1e-9 && hem.lines[0].kind === 'hem', `Dastur: ${fmt(hem.W, 4)} mm`);
  const k = computeProfile({ segs: [{ dir: 'D', L: 50 }, { dir: 'R', L: 50 }] }, { unit: 'mm', T: 2, calc: 'k', R: 2, K: 0.33 });
  const hand = 100 - (2 * 4 - Math.PI / 2 * (2 + 0.66));
  ok('K-faktor: L 50×50, T=2, R=2, K=0.33 → 96.1783 mm', Math.abs(k.W - hand) < 1e-9, `Qoʻlda ${fmt(hand, 4)}; dastur ${fmt(k.W, 4)} mm`);
  const parts = [
    { id: 'P1', name: 'GAP', X: 2000, Y: 220, qty: 7, outline: null, bends: tr.bends, area: 440000 },
    { id: 'P2', name: 'H', X: 3000, Y: 110, qty: 5, outline: null, bends: [], area: 330000 },
    Object.assign({ id: 'P3', name: 'Kasseta', qty: 6 }, kas)
  ];
  [false, true].forEach(cl => {
    const r = nestStrips(parts, { sheetW: 1250, maxLen: 6000, margin: 5, gap: 3, rotate: false, commonLine: cl });
    const placed = sum(r.sheets.map(s => s.count)), ve = sum(r.sheets.map(s => s.verify.length));
    let dxfOk = true, det = '';
    ['AC1009', 'AC1015'].forEach(ver => [false, true].forEach(ral => r.sheets.forEach(sh => { const t = dxfFromPrims(sheetPrims(sh, { bendLayer: true }), { ver, prec: 3, rectAsLines: ral }), P = parseDXF(t), v = validateDXF(P, { openOk: cl }); if (!v.ok || !P.eof) { dxfOk = false; det += v.issues.map(i => i.msg).join('; '); } })));
    ok(`Raskroy ${cl ? '(umumiy chiziq)' : '(alohida konturlar)'}: 18 detal (kasseta bilan), kesishmaydi, DXF toza`, placed === 18 && ve === 0 && dxfOk && !r.unplaced.length, `Joylandi ${placed}/18, listlar ${r.sheets.length} (${r.sheets.map(s => s.usedLen).join(', ')} mm), tekshiruv xatolari ${ve}${det ? '; DXF: ' + det : ''}`);
  });
  return R;
}

return { GenError, fmt, num, MATERIALS, DIRS, ARROW, SIDE_MODES, segDir, normAng, normTurn, rowTurns, computeProfile, buildPart, sidesFor, bendCalc, dxfFromPrims, parseDXF, validateDXF, nestStrips, placeFn, sheetPrims, singlePrims, verifySheet, selfTest };
})();
export default Core;
