// @ts-nocheck
/* Buyurtma modeli: shablonlar, standart sozlamalar, hisoblash, DXF fayllar. DOM ga bogʻliq emas. */
import C from './core';

const S_ = (dir, L, side) => side ? { dir, L, side } : { dir, L };
/* Shablonlar (oʻlchamlar mm da; qoʻshilganda tanlangan birlikka oʻtkaziladi) */
export const TPL = {
  chiz: { name: 'Yangi kesim', type: 'profile', len: 2000, segs: [], blank: true },
  gap: { name: 'GAP', type: 'tray', sideMode: '2s', base: 100, len: 2000, sides: { R: [S_('U', 20), S_('L', 20), S_('U', 20)] } },
  pplanka: { name: 'P-planka', type: 'tray', sideMode: '2s', base: 100, len: 2000, sides: { R: [S_('U', 20)] } },
  kasseta: { name: 'Kasseta (4 tomon bir xil)', type: 'tray', sideMode: '4s', base: 500, baseL: 1000, sides: { R: [S_('U', 30), S_('R', 10)] } },
  lotok: { name: 'Lotok (juft tomonlar)', type: 'tray', sideMode: '4p', base: 300, baseL: 1200, sides: { R: [S_('U', 50)], T: [S_('U', 30)] } },
  har: { name: '4 tomon har xil', type: 'tray', sideMode: '4d', base: 400, baseL: 800, sides: { R: [S_('U', 40)], L: [S_('U', 40), S_('L', 15)], T: [S_('U', 25)], B: [S_('D', 15)] } },
  ugolok: { name: 'Ugolok (L)', type: 'profile', len: 2000, segs: [S_('D', 50), S_('R', 50)] },
  otliv: { name: 'Otliv (deraza)', type: 'profile', len: 2000, segs: [S_('U', 20), S_('L', 200), S_('D', 25), S_('DR', 10)] },
  konyok: { name: 'Konyok', type: 'profile', len: 2000, segs: [S_('DR', 15), S_('UR', 150), S_('DR', 150), S_('UR', 15)] },
  erkin: { name: 'Erkin kesim', type: 'profile', len: 2000, segs: [S_('R', 100)] }
};
export const DEF = { unit: 'sm', mat: 'galv', T: 0.5, calc: 'sum', R: 0.5, K: 0.33, sheetW: 1250, maxLen: 6000, margin: 5, gap: 3, rotate: false, commonLine: false, dxfVer: 'AC1015', rectAsLines: false, bendLayer: false, labelLayer: false, sheetLayer: false, speed: 30, pierce: 0.1, prec: 3 };
export const SIDE_NAMES = { R: 'Oʻng tomon', L: 'Chap tomon', T: 'Yuqori tomon', B: 'Past tomon' };
/** Rejim boʻyicha koʻrsatiladigan tomon muharrirlari */
export const SIDE_EDITORS = {
  '2s': [['R', 'Ikkala tomon (bir xil)']], '2d': [['R', SIDE_NAMES.R], ['L', SIDE_NAMES.L]],
  '4s': [['R', 'Toʻrtala tomon (bir xil)']], '4p': [['R', 'Uzun tomonlar (oʻng + chap)'], ['T', 'Qisqa tomonlar (yuqori + past)']],
  '4d': [['R', SIDE_NAMES.R], ['L', SIDE_NAMES.L], ['T', SIDE_NAMES.T], ['B', SIDE_NAMES.B]]
};

export function newProject() {
  const p = Object.assign({ items: [], nextId: 1 }, JSON.parse(JSON.stringify(DEF)));
  return p;
}
/** Shablondan yangi detal (p.nextId oshadi) */
export function mkItem(key, p, qty = 1) {
  const t = JSON.parse(JSON.stringify(TPL[key])), k = p.unit === 'sm' ? 0.1 : 1, cv = v => +(v * k).toFixed(4);
  const conv = segs => segs.map(s => s.t === 'arc' ? Object.assign(s, { r: cv(s.r) }) : Object.assign(s, { L: cv(s.L) }));
  const it = { id: 'P' + (p.nextId++), name: t.name, type: t.type, qty, len: t.len || 2000 };
  if (t.type === 'tray') { it.sideMode = t.sideMode; it.base = cv(t.base); it.baseL = cv(t.baseL || t.base); it.sides = {}; ['R', 'L', 'T', 'B'].forEach(s => it.sides[s] = conv(t.sides[s] || [])); }
  else it.segs = conv(t.segs);
  return it;
}
/** Serverdan kelgan maʼlumotni tozalash */
export function sanitize(o) {
  if (!o || !Array.isArray(o.items)) return newProject();
  const p = Object.assign(newProject(), o);
  p.items = o.items.filter(i => i && (Array.isArray(i.segs) || i.type === 'tray')).map(i => {
    const it = Object.assign({ qty: 1, len: 2000, name: 'Detal', type: 'profile' }, i);
    if (it.type === 'tray') { it.sides = Object.assign({ R: [], L: [], T: [], B: [] }, it.sides || {}); if (!C.SIDE_MODES[it.sideMode]) it.sideMode = '2s'; }
    return it;
  });
  p.nextId = Math.max(+o.nextId || 1, ...p.items.map(i => (+String(i.id).replace(/\D/g, '') || 0) + 1));
  return p;
}
/** Birlikni almashtirish (barcha kesim oʻlchamlari qayta hisoblanadi) */
export function convertUnit(p, to) {
  if (to === p.unit) return;
  const k = to === 'sm' ? 0.1 : 10, cv = v => +(v * k).toFixed(4);
  const conv = segs => (segs || []).forEach(s => { if (s.t === 'arc') s.r = cv(s.r); else s.L = cv(s.L); });
  p.items.forEach(i => { if (i.type === 'tray') { i.base = cv(i.base); i.baseL = cv(i.baseL); Object.values(i.sides).forEach(conv); } else conv(i.segs); });
  p.unit = to;
}
/** Tomonlar rejimini almashtirish: yangi ochilgan boʻsh tomonlarga mavjud profil nusxalanadi */
export function setSideMode(it, mode) {
  const prev = C.sidesFor(it), cp = a => JSON.parse(JSON.stringify(a || []));
  it.sideMode = mode;
  ['L', 'T', 'B'].forEach(k => { if (!(it.sides[k] || []).length) it.sides[k] = cp(prev[k] && prev[k].length ? prev[k] : it.sides.R); });
  if (mode[0] === '4' && !(+it.baseL > 0)) it.baseL = it.base;
}
/** Hamma detallarni hisoblash + raskroy */
export function regen(P) {
  const PART = new Map(), ERR = new Map(); let NEST = null, NEST_ERR = null;
  P.items.forEach(it => {
    try { C.num(it.qty, 'Soni', { min: 0, int: true }); PART.set(it.id, C.buildPart(it, P)); }
    catch (e) { ERR.set(it.id, e.name === 'GenError' ? e.message : 'Ichki xato: ' + e.message); if (e.name !== 'GenError') console.error(e); }
  });
  const parts = P.items.filter(it => PART.has(it.id)).map(it => Object.assign({ id: it.id, name: it.name, qty: +it.qty }, PART.get(it.id)));
  try { NEST = C.nestStrips(parts, P); } catch (e) { NEST_ERR = e.message; }
  return { PART, ERR, NEST, NEST_ERR };
}

/* ---------------- DXF ---------------- */
export const san = s => String(s).trim().replace(/[^\w.\-]+/g, '_').replace(/^_+|_+$/g, '') || 'x';
const dxfOpt = P => ({ ver: P.dxfVer, prec: Math.max(2, Math.min(6, Math.round(+P.prec || 3))), rectAsLines: !!P.rectAsLines });
const layerOpt = P => ({ bendLayer: !!P.bendLayer, labelLayer: !!P.labelLayer, sheetLayer: !!P.sheetLayer });
export const sheetName = (P, name, sh) => `${san(name)}_list${sh.index}_${C.fmt(P.T)}mm_${sh.usedLen}x${sh.SW}.dxf`;
export const sheetDXF = (P, sh) => C.dxfFromPrims(C.sheetPrims(sh, layerOpt(P)), dxfOpt(P));
export const partName = (name, it, pt) => `${san(name)}_${it.id}_${san(it.name)}_${C.fmt(pt.Y, 1)}x${C.fmt(pt.X, 1)}.dxf`;
export const partDXF = (P, it, pt) => C.dxfFromPrims(C.singlePrims(Object.assign({ id: it.id, name: it.name }, pt), layerOpt(P)), dxfOpt(P));
export function download(name, data, mime = 'application/dxf') {
  const b = data instanceof Blob ? data : new Blob([data], { type: mime }), a = document.createElement('a');
  a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
/** DXF ni qayta oʻqib tekshirib yuklash; muammo boʻlsa tasdiq soʻraladi */
export function checkedDownload(name, txt, extra = [], openOk = false) {
  const v = C.validateDXF(C.parseDXF(txt), { openOk }), errs = [...extra, ...v.issues.map(i => i.msg)];
  if (errs.length && !window.confirm(`${name}: ${errs.length} ta muammo:\n\n${errs.slice(0, 8).join('\n')}\n\nBaribir yuklab olinsinmi?`)) return;
  download(name, txt);
}
export async function zipAll(P, name, R) {
  if (!R.NEST || !R.NEST.sheets.length) return 'Raskroy natijasi yoʻq';
  const { default: JSZip } = await import('jszip');
  const z = new JSZip(); let bad = 0;
  R.NEST.sheets.forEach(sh => { const t = sheetDXF(P, sh); if (!C.validateDXF(C.parseDXF(t), { openOk: P.commonLine }).ok || sh.verify.length) bad++; z.file(sheetName(P, name, sh), t); });
  P.items.filter(it => R.PART.has(it.id)).forEach(it => { const pt = R.PART.get(it.id); z.file('detallar/' + partName(name, it, pt), partDXF(P, it, pt)); });
  download(`${san(name)}_DXF.zip`, await z.generateAsync({ type: 'blob' }), 'application/zip');
  return bad ? `Diqqat: ${bad} ta listda muammo bor («Tekshiruv»)` : 'ZIP yuklandi';
}
