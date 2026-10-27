'use client';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import Core from '@/lib/core';
import { Pt, Seg, chainGeom, snapSeg, snapArc, normAng, normTurn, unitVec, toNum, clean } from '@/lib/sketch';
import { Icon, IconName } from './Icons';
import { useConfirm } from './ui';
const C: any = Core;
const fmt = C.fmt;

export type SketchOpts = { angStep: number; lenStep: number; grid: boolean; dims: boolean; angles: boolean; overall: boolean; track: boolean };
export type Ghost = { pts: Pt[]; kind: 'base' | 'ghost' };
type Tool = 'select' | 'line' | 'arc' | 'pan';
type View = { s: number; tx: number; ty: number };
type Drag = { kind: 'pan'; x: number; y: number; tx: number; ty: number } | { kind: 'vertex'; i: number; tag: string } | null;
type Edit = { kind: 'seg' | 'base'; i: number; x: number; y: number; v: string } | null;

type Props = {
  segs: Seg[]; d0: number | null; origin: Pt; mirror: boolean; ghosts: Ghost[];
  baseDim?: { a: Pt; b: Pt; value: number; onEdit: (v: number) => void };
  unit: string; hv: number; viewKey: string; canPrepend: boolean;
  sel: number | null; onSel: (i: number | null) => void;
  onChange: (segs: Seg[], tag?: string) => void;
  opts: SketchOpts; setOpts: (o: SketchOpts) => void;
  onUndo: () => void; onRedo: () => void; canUndo: boolean; canRedo: boolean;
};

const ANG_STEPS = [1, 5, 15, 45, 90];
export const LEN_STEPS: Record<string, number[]> = { mm: [0.1, 0.5, 1, 5, 10], sm: [0.01, 0.05, 0.1, 0.5, 1] };
const HINT: Record<Tool, string> = {
  select: 'Segmentni bosing — tanlash · uchini suring — oʻzgartirish · oʻlcham yozuvini bosing — aniq qiymat · Del — oʻchirish',
  line: 'Bosing — segment · raqam + Enter — aniq uzunlik (25<45 — burchak bilan) · ← ↑ → ↓ — yoʻnalishni qotirish · Shift — erkin burchak · Backspace — oxirgisini oʻchirish · Esc — tugatish',
  arc: 'Yoy oxirgi segmentga urinma boʻladi · bosing — qoʻshish · Shift — erkin burchak · Esc — tugatish',
  pan: 'Sudrab suring · gʻildirak — masshtab · F — hammasini koʻrsatish',
};
const TYPED = /^(\d+(?:[.,]\d*)?)?(?:\s*[<@]\s*(-?\d*(?:[.,]\d*)?))?$/;
function parseTyped(t: string): { L?: number; A?: number } | null {
  const m = t.match(TYPED); if (!m) return null;
  const L = m[1] ? toNum(m[1]) : undefined, A = m[2] && m[2] !== '-' ? toNum(m[2]) : undefined;
  return { L: L !== undefined && isFinite(L) ? L : undefined, A: A !== undefined && isFinite(A) ? A : undefined };
}

export default function Sketch(p: Props) {
  const { segs, d0, origin, mirror, ghosts, unit, hv, sel, onSel, onChange, opts, setOpts } = p;
  const uid = useId().replace(/:/g, '');
  const wrap = useRef<HTMLDivElement>(null), svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View>({ s: 1, tx: 0, ty: 0 });
  const [tool, setTool] = useState<Tool>(segs.length ? 'select' : 'line');
  const [cur, setCur] = useState<Pt | null>(null);
  const [typed, setTyped] = useState('');
  const [lock, setLock] = useState<number | null>(null);
  const [fromStart, setFromStart] = useState(false);
  const [started, setStarted] = useState(false); // boshlangʻich nuqta tanlanganmi
  const [shift, setShift] = useState(false);
  const [space, setSpace] = useState(false);
  const [edit, setEdit] = useState<Edit>(null);
  const drag = useRef<Drag>(null);
  const [dragging, setDragging] = useState<'' | 'pan' | 'vertex'>('');

  /* ---------- koordinatalar: lokal (zanjir) → dunyo → ekran ---------- */
  const mx = mirror ? -1 : 1;
  const L2W = (q: Pt): Pt => [origin[0] + mx * q[0], origin[1] + q[1]];
  const W2L = (q: Pt): Pt => [(q[0] - origin[0]) * mx, q[1] - origin[1]];
  const W2S = (q: Pt): Pt => [q[0] * view.s + view.tx, -q[1] * view.s + view.ty];
  const S2W = (x: number, y: number): Pt => [(x - view.tx) / view.s, (view.ty - y) / view.s];
  const L2S = (q: Pt) => W2S(L2W(q));
  /** lokal burchak ↔ ekranda koʻrinadigan burchak (koʻzgu tomonida teskari) */
  const locToScr = (a: number) => (mirror ? normAng(180 - a) : normAng(a));
  const scrToLoc = locToScr;
  const scrVec = (localDeg: number): Pt => { const u = unitVec(localDeg); return [mx * u[0], -u[1]]; };

  const G = useMemo(() => chainGeom(segs, d0, hv), [segs, d0, hv]);
  const worldPts = useMemo(() => [L2W([0, 0]), ...G.segs.flatMap(g => g.pts.map(L2W)), ...ghosts.flatMap(g => g.pts)],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [G, ghosts, origin[0], origin[1], mirror]);

  /* ---------- oʻlcham va moslash ---------- */
  useEffect(() => {
    const el = wrap.current; if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el); setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  function fit(pts = worldPts, w = size.w, h = size.h) {
    if (!w || !h) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    pts.forEach(q => { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); });
    const minExt = unit === 'sm' ? 6 : 60, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const bw = Math.max(x1 - x0, minExt), bh = Math.max(y1 - y0, minExt);
    const s = Math.min((w - 180) / bw, (h - 150) / bh);
    setView({ s: Math.max(s, 1e-3), tx: w / 2 - cx * s, ty: h / 2 + cy * s });
  }
  // boshqa detal/tomon ochilganda koʻrinishni moslash
  const fitted = useRef(''), ready = size.w > 0 && size.h > 0;
  useEffect(() => {
    if (!ready || fitted.current === p.viewKey) return;
    fitted.current = p.viewKey; fit(); setFromStart(false); setTyped(''); setLock(null); setEdit(null);
    setTool(segs.length ? 'select' : 'line');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.viewKey, ready]);

  // chizish paytida koʻrinish oʻzgarmaydi: foydalanuvchi surgan holatda qoladi (F — hammasini koʻrsatish)

  function zoomAt(x: number, y: number, k: number) {
    setView(v => { const s = Math.min(Math.max(v.s * k, 1e-3), 2e4), kk = s / v.s; return { s, tx: x - (x - v.tx) * kk, ty: y - (y - v.ty) * kk }; });
  }
  useEffect(() => {
    const sv = svgRef.current; if (!sv) return;
    const h = (e: WheelEvent) => { e.preventDefault(); const r = sv.getBoundingClientRect(); zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015)); };
    sv.addEventListener('wheel', h, { passive: false });
    return () => sv.removeEventListener('wheel', h);
  }, []);

  /* ---------- chizish: snap va oldindan koʻrish ---------- */
  const tol = 8 / view.s;
  // 0 nuqta izlash nishoni emas: erkin chizishda unga yopishmaslik kerak
  const chainVerts = useMemo(() => G.segs.map(g => g.b), [G]);
  const targets = useMemo(() => opts.track ? [...chainVerts, ...ghosts.flatMap(g => g.pts).map(W2L)] : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [opts.track, chainVerts, ghosts, origin[0], origin[1], mirror]);
  const anchor: Pt = fromStart ? [0, 0] : G.end;
  const curL = cur ? W2L(cur) : null;
  const tp = parseTyped(typed);
  const lockLoc = lock === null ? null : scrToLoc(lock);
  const angTyped = tp?.A !== undefined ? scrToLoc(tp.A) : null;

  let preview: { ang: number; L: number; end: Pt; track: Pt | null } | null = null;
  const placed = started || segs.length > 0 || !!tp?.L;
  if (tool === 'line' && !dragging && placed) {
    const fixed = angTyped ?? lockLoc;
    if (curL) preview = snapSeg(anchor, curL, { angStep: opts.angStep, lenStep: opts.lenStep, free: shift, lock: fixed, targets: tp?.L ? [] : targets, tol });
    else if (tp?.L) preview = { ang: fixed ?? (fromStart ? 180 : G.endDir ?? 0), L: 0, end: anchor, track: null };
    if (preview && tp?.L !== undefined) { const u = unitVec(preview.ang); preview = { ang: preview.ang, L: tp.L, end: [anchor[0] + u[0] * tp.L, anchor[1] + u[1] * tp.L], track: null }; }
  }
  const arcPrev = tool === 'arc' && curL && G.endDir !== null && !dragging ? snapArc(G.end, G.endDir, curL, { angStep: opts.angStep, lenStep: opts.lenStep, free: shift }) : null;
  const arcGeom = arcPrev ? chainGeom([...segs, arcPrev], d0, hv).segs.at(-1) : null;

  function commitLine(sn: { ang: number; L: number; end: Pt }) {
    if (!(sn.L > 0)) return;
    if (fromStart) {
      const seg: Seg = { ang: clean(normAng(sn.ang + 180)), L: clean(sn.L) };
      setView(v => ({ ...v, tx: v.tx + mx * sn.end[0] * v.s, ty: v.ty - sn.end[1] * v.s }));
      onChange([seg, ...segs]);
      if (sel !== null) onSel(sel + 1);
    } else {
      const seg: Seg = { ang: sn.ang, L: clean(sn.L) };
      if (G.endDir !== null && Math.abs(Math.abs(normTurn(sn.ang - G.endDir)) - 180) < 1e-9) {
        const u = unitVec(G.endDir), v = curL ? [curL[0] - anchor[0], curL[1] - anchor[1]] : [0, 1];
        seg.side = u[0] * v[1] - u[1] * v[0] >= 0 ? 'L' : 'R';
      }
      onChange([...segs, seg]);
    }
    setTyped('');
  }
  function removeEnd() {
    if (!segs.length) return;
    if (fromStart) { const g = G.segs[0]; setView(v => ({ ...v, tx: v.tx - mx * (g.b[0]) * v.s, ty: v.ty + g.b[1] * v.s })); onChange(segs.slice(1)); }
    else onChange(segs.slice(0, -1));
    if (sel !== null && sel >= segs.length - 1) onSel(null);
  }
  function deleteSeg(i: number) { onChange(segs.filter((_, j) => j !== i)); onSel(null); }

  /* ---------- oʻlcham yozuvini tahrirlash ---------- */
  function openEdit(i: number, initial?: string) {
    const g = G.segs[i]; if (!g) return;
    const s = segs[i], m = g.kind === 'arc' ? g.pts[Math.floor(g.pts.length / 2)] : [(g.a[0] + g.b[0]) / 2, (g.a[1] + g.b[1]) / 2] as Pt;
    const q = L2S(m);
    setEdit({ kind: 'seg', i, x: q[0], y: q[1], v: initial ?? String(s.t === 'arc' ? s.r ?? '' : s.L ?? '') });
  }
  function applyEdit(e: Edit) {
    setEdit(null);
    if (!e) return;
    const v = toNum(e.v); if (!(v > 0)) return;
    if (e.kind === 'base') { p.baseDim?.onEdit(v); return; }
    onChange(segs.map((s, j) => j !== e.i ? s : s.t === 'arc' ? { ...s, r: clean(v) } : { ...s, L: clean(v) }));
  }

  /* ---------- sichqoncha ---------- */
  const local = (e: React.PointerEvent) => { const r = svgRef.current!.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] as Pt; };
  function onDown(e: React.PointerEvent<SVGSVGElement>) {
    const [sx, sy] = local(e);
    if (edit) applyEdit(edit);
    if (e.button === 1 || e.button === 2 || tool === 'pan' || space) {
      e.preventDefault(); drag.current = { kind: 'pan', x: sx, y: sy, tx: view.tx, ty: view.ty }; setDragging('pan');
      e.currentTarget.setPointerCapture(e.pointerId); return;
    }
    if (e.button !== 0) return;
    // brauzerning standart fokus/tanlash harakati ochilgan oʻlcham maydonini yopib qoʻymasin
    e.preventDefault(); (document.activeElement as HTMLElement | null)?.blur?.();
    const el = (e.target as Element).closest('[data-role]'), role = el?.getAttribute('data-role') ?? '', idx = +(el?.getAttribute('data-i') ?? -1);
    if (tool === 'select') {
      if (role === 'v') { drag.current = { kind: 'vertex', i: idx, tag: 'drag' + Date.now() }; setDragging('vertex'); onSel(idx); e.currentTarget.setPointerCapture(e.pointerId); return; }
      if (role === 'dim') { onSel(idx); openEdit(idx); return; }
      if (role === 'base' && p.baseDim) { const q = W2S([(p.baseDim.a[0] + p.baseDim.b[0]) / 2, p.baseDim.a[1]]); setEdit({ kind: 'base', i: -1, x: q[0], y: q[1] + 20, v: String(p.baseDim.value) }); return; }
      if (role === 'seg') { onSel(idx); return; }
      onSel(null); return;
    }
    if (tool === 'line') {
      if (role === 'start' && p.canPrepend && segs.length) { setFromStart(true); return; }
      if (role === 'end') { setFromStart(false); return; }
      if (!placed) {
        // birinchi bosish: kesim boshini ixtiyoriy joyga qoʻyish
        const o = L2W([0, 0]);
        setView(v => ({ ...v, tx: sx - o[0] * v.s, ty: sy + o[1] * v.s }));
        setStarted(true); return;
      }
      if (preview) commitLine(preview);
      return;
    }
    if (tool === 'arc' && arcPrev) onChange([...segs, arcPrev]);
  }
  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const [sx, sy] = local(e), w = S2W(sx, sy);
    setCur(w);
    const d = drag.current;
    if (d?.kind === 'pan') setView(v => ({ ...v, tx: d.tx + sx - d.x, ty: d.ty + sy - d.y }));
    else if (d?.kind === 'vertex') {
      const g = G.segs[d.i]; if (!g || g.kind !== 'line') return;
      const tg = opts.track ? [...chainVerts.slice(0, d.i), ...ghosts.flatMap(q => q.pts).map(W2L)] : [];
      const sn = snapSeg(g.a, W2L(w), { angStep: opts.angStep, lenStep: opts.lenStep, free: e.shiftKey, targets: tg, tol });
      if (!(sn.L > 0)) return;
      const s = segs[d.i];
      if (toNum(s.L) === sn.L && C.segDir(s) === sn.ang) return;
      const ns: Seg = { ...s, ang: sn.ang, L: sn.L }; delete ns.dir;
      onChange(segs.map((x, j) => (j === d.i ? ns : x)), d.tag);
    }
  }
  function onUp(e: React.PointerEvent<SVGSVGElement>) {
    if (drag.current) { try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* */ } }
    drag.current = null; setDragging('');
  }

  /* ---------- klaviatura ---------- */
  const keyRef = useRef<(e: KeyboardEvent, down: boolean) => void>(() => {});
  keyRef.current = (e, down) => {
    const t = e.target as HTMLElement;
    if (e.key === 'Shift') setShift(down);
    if (e.key === ' ' && !t.closest?.('input,textarea,select,button')) { setSpace(down); if (down) e.preventDefault(); return; }
    if (!down || e.ctrlKey || e.metaKey || e.altKey) return;
    if (t.closest?.('input,textarea,select,[contenteditable="true"]')) return;
    const k = e.key;
    if (tool === 'line' && /^[0-9.,<@-]$/.test(k)) { setTyped(s => s + k); e.preventDefault(); return; }
    if (tool === 'select' && sel !== null && /^[0-9]$/.test(k)) { openEdit(sel, k); e.preventDefault(); return; }
    if (k === 'Enter' && tool === 'line' && tp?.L && preview) { commitLine(preview); e.preventDefault(); return; }
    if (k === 'Backspace') { e.preventDefault(); if (typed) setTyped(s => s.slice(0, -1)); else if (tool === 'line' || tool === 'arc') removeEnd(); else if (sel !== null) deleteSeg(sel); return; }
    if (k === 'Delete' && sel !== null) { deleteSeg(sel); return; }
    if (k === 'Escape') { if (typed) setTyped(''); else if (lock !== null) setLock(null); else if (tool !== 'select') { setTool('select'); setFromStart(false); } else onSel(null); return; }
    const arrows: Record<string, number> = { ArrowRight: 0, ArrowUp: 90, ArrowLeft: 180, ArrowDown: 270 };
    if (k in arrows && tool === 'line') { e.preventDefault(); setLock(l => (l === arrows[k] ? null : arrows[k])); return; }
    const lk = k.toLowerCase();
    if (lk === 'v') pickTool('select'); else if (lk === 'l') pickTool('line'); else if (lk === 'a') pickTool('arc'); else if (lk === 'h') pickTool('pan');
    else if (lk === 'f') fit(); else if (lk === 'g') setOpts({ ...opts, grid: !opts.grid });
  };
  useEffect(() => {
    const kd = (e: KeyboardEvent) => keyRef.current(e, true), ku = (e: KeyboardEvent) => keyRef.current(e, false);
    const blur = () => { setShift(false); setSpace(false); };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('blur', blur); };
  }, []);
  function pickTool(t: Tool) { setTool(t); setTyped(''); setLock(null); if (t !== 'line') setFromStart(false); }

  /* ---------- chizish elementlari ---------- */
  const W = size.w, H = size.h;
  let grid: { step: number; major: number } | null = null;
  if (opts.grid) { let st = 1e-3; const c = [1, 2, 5]; outer: for (let e = -3; e < 8; e++) for (const m of c) { st = m * 10 ** e; if (st * view.s >= 12) break outer; } grid = { step: st, major: st * 5 }; }

  const chainScr = [L2S([0, 0]), ...G.segs.flatMap(g => g.pts.slice(g.kind === 'line' && !g.hem ? 1 : 0).map(L2S))];
  const allScr = worldPts.map(W2S);
  const cen: Pt = allScr.length ? [allScr.reduce((s, q) => s + q[0], 0) / allScr.length, allScr.reduce((s, q) => s + q[1], 0) / allScr.length] : [0, 0];
  const pathOf = (pts: Pt[]) => pts.map((q, i) => `${i ? 'L' : 'M'}${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join(' ');

  const dimsAll = opts.dims ? G.segs.map(g => {
    if (!g.ok) return null;
    const s = segs[g.i];
    if (g.kind === 'arc') {
      const m = L2S(g.pts[Math.floor(g.pts.length / 2)]), c = L2S(g.c!), v: Pt = [m[0] - c[0], m[1] - c[1]], n = Math.hypot(v[0], v[1]) || 1;
      const txt = `R${fmt(toNum(s.r), 2)} · ${fmt(toNum(s.a), 1)}°`, w = txt.length * 6.6 + 12, off = 14 + w / 2 * Math.abs(v[0] / n) + 6;
      return { i: g.i, x: m[0] + v[0] / n * off, y: m[1] + v[1] / n * off, txt, w };
    }
    const A = L2S(g.a), B = L2S(g.b), m: Pt = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2], len = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1;
    let n: Pt = [-(B[1] - A[1]) / len, (B[0] - A[0]) / len];
    if ((m[0] - cen[0]) * n[0] + (m[1] - cen[1]) * n[1] < 0) n = [-n[0], -n[1]];
    const txt = fmt(toNum(s.L), 2), w = txt.length * 7.2 + 14, off = 12 + Math.abs(n[0]) * w / 2 + Math.abs(n[1]) * 9;
    return { i: g.i, x: m[0] + n[0] * off, y: m[1] + n[1] * off, txt, w };
  }).filter(Boolean) as { i: number; x: number; y: number; txt: string; w: number }[] : [];

  const angsAll = opts.angles ? G.segs.map(g => {
    if (!g.ok || g.kind !== 'line' || g.hem || g.prevDir === null || g.turn === null || Math.abs(g.turn) < 0.01) return null;
    const V = L2S(g.a), b = scrVec(g.prevDir + 180), f = scrVec(g.dir), r = 18;
    const bis: Pt = [b[0] + f[0], b[1] + f[1]], bl = Math.hypot(bis[0], bis[1]); if (bl < 1e-6) return null;
    const p1: Pt = [V[0] + b[0] * r, V[1] + b[1] * r], p2: Pt = [V[0] + f[0] * r, V[1] + f[1] * r], sweep = b[0] * f[1] - b[1] * f[0] > 0 ? 1 : 0;
    return { i: g.i, d: `M${p1[0]} ${p1[1]} A${r} ${r} 0 0 ${sweep} ${p2[0]} ${p2[1]}`, x: V[0] + bis[0] / bl * (r + 15), y: V[1] + bis[1] / bl * (r + 15), txt: `${fmt(180 - Math.abs(g.turn), 1)}°` };
  }).filter(Boolean) as { i: number; d: string; x: number; y: number; txt: string }[] : [];
  // kichraytirilganda yozuvlar bir-birining ustiga tushmasin: uzun kesmalar birinchi, sigʻmaganlari yashiriladi
  const segScr = (i: number) => { const g = G.segs[i]; if (!g) return 0; const A = L2S(g.a), B = L2S(g.b); return Math.hypot(B[0] - A[0], B[1] - A[1]); };
  const taken: { x0: number; y0: number; x1: number; y1: number }[] = [];
  const free = (cx: number, cy: number, w: number, h: number) => {
    const r = { x0: cx - w / 2 - 2, y0: cy - h / 2 - 2, x1: cx + w / 2 + 2, y1: cy + h / 2 + 2 };
    if (taken.some(t => r.x0 < t.x1 && r.x1 > t.x0 && r.y0 < t.y1 && r.y1 > t.y0)) return false;
    taken.push(r); return true;
  };
  const dimKeep = new Set<number>();
  [...dimsAll].sort((a, b) => (b.i === sel ? 1 : 0) - (a.i === sel ? 1 : 0) || segScr(b.i) - segScr(a.i))
    .forEach(d => { if (d.i === sel || free(d.x, d.y, d.w, 18)) dimKeep.add(d.i); });
  const dims = dimsAll.filter(d => dimKeep.has(d.i));
  const angs = angsAll.filter(a => segScr(a.i) >= 24 && segScr(a.i - 1) >= 24 && free(a.x, a.y, a.txt.length * 6.6 + 8, 14));
  const hems = G.segs.filter(g => g.hem && g.ok).map(g => ({ i: g.i, q: L2S(g.a) }));

  let overall: null | { x0: number; x1: number; y0: number; y1: number; w: number; h: number } = null;
  if (opts.overall && worldPts.length > 1) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    worldPts.forEach(q => { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); });
    if (x1 - x0 > 1e-6 || y1 - y0 > 1e-6) { const a = W2S([x0, y1]), b = W2S([x1, y0]); overall = { x0: a[0], y0: a[1], x1: b[0], y1: b[1], w: x1 - x0, h: y1 - y0 }; }
  }

  const prevA = L2S(anchor), prevB = preview ? L2S(preview.end) : null;
  const tipTxt = (() => {
    if (tool === 'line' && preview) {
      const turn = !fromStart && G.endDir !== null ? normTurn(preview.ang - G.endDir) : null;
      return `${fmt(preview.L, 2)} ${unit} · ${fmt(locToScr(preview.ang), 1)}°${turn !== null && Math.abs(turn) > 0.01 ? ` · ∠${fmt(180 - Math.abs(turn), 1)}°` : ''}`;
    }
    if (tool === 'arc' && arcPrev) return `R${fmt(arcPrev.r, 2)} · ${fmt(arcPrev.a, 1)}°`;
    return '';
  })();
  const curS = cur ? W2S(cur) : null;
  const curLoc = cur ? W2L(cur) : null;
  const cursorCls = dragging === 'pan' ? 'grabbing' : tool === 'pan' || space ? 'grab' : tool === 'select' ? 'default' : 'crosshair';

  const confirm = useConfirm();
  const tools: [Tool, IconName, string, string][] = [['select', 'select', 'Tanlash (V)', 'Tanlash'], ['line', 'line', 'Chiziq chizish (L)', 'Chiziq'], ['arc', 'arc', 'Yoy (A)', 'Yoy'], ['pan', 'pan', 'Surish (H, yoki oʻrta tugma / Probel)', 'Surish']];
  const empty = !segs.length;

  return (
    <div className="sk">
      <div className="sk-tools" role="toolbar" aria-label="Chizma asboblari">
        {tools.map(([t, ic, title, label]) => <button key={t} className={tool === t ? 'on' : ''} title={title} aria-label={title} onClick={() => pickTool(t)}><Icon name={ic} />{label}</button>)}
        <span className="sep" />
        <button title="Bekor qilish (Ctrl+Z)" aria-label="Bekor qilish" disabled={!p.canUndo} onClick={p.onUndo}><Icon name="undo" /></button>
        <button title="Qaytarish (Ctrl+Y)" aria-label="Qaytarish" disabled={!p.canRedo} onClick={p.onRedo}><Icon name="redo" /></button>
        <span className="sep" />
        <button title="Yaqinlashtirish" aria-label="Yaqinlashtirish" onClick={() => zoomAt(W / 2, H / 2, 1.25)}><Icon name="zoomIn" /></button>
        <button title="Uzoqlashtirish" aria-label="Uzoqlashtirish" onClick={() => zoomAt(W / 2, H / 2, 0.8)}><Icon name="zoomOut" /></button>
        <button title="Hammasini koʻrsatish (F)" aria-label="Hammasini koʻrsatish" onClick={() => fit()}><Icon name="fit" /></button>
        <span className="sep" />
        <button title="Kesimni tozalash" aria-label="Kesimni tozalash" disabled={empty} onClick={async () => { if (await confirm({ title: 'Kesimni tozalash', text: 'Barcha segmentlar oʻchiriladi. Ctrl+Z bilan qaytarish mumkin.', ok: 'Tozalash' })) { onChange([]); onSel(null); setStarted(false); pickTool('line'); } }}><Icon name="trash" />Tozalash</button>
      </div>

      <div className="sk-canvas" ref={wrap}>
        <svg ref={svgRef} width={W} height={H} className={`tool-${tool}`} style={{ cursor: cursorCls }}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={() => { if (!drag.current) setCur(null); }}
          onContextMenu={e => e.preventDefault()}>
          {grid && <defs>
            <pattern id={`g1${uid}`} width={grid.step * view.s} height={grid.step * view.s} patternUnits="userSpaceOnUse" x={view.tx} y={view.ty}>
              <path d={`M${grid.step * view.s} 0H0V${grid.step * view.s}`} className="sk-grid-minor" fill="none" />
            </pattern>
            <pattern id={`g2${uid}`} width={grid.major * view.s} height={grid.major * view.s} patternUnits="userSpaceOnUse" x={view.tx} y={view.ty}>
              <path d={`M${grid.major * view.s} 0H0V${grid.major * view.s}`} className="sk-grid-major" fill="none" />
            </pattern>
          </defs>}
          {grid && <><rect width={W} height={H} fill={`url(#g1${uid})`} /><rect width={W} height={H} fill={`url(#g2${uid})`} /></>}
          <line x1={0} x2={W} y1={view.ty} y2={view.ty} className="sk-axis" /><line y1={0} y2={H} x1={view.tx} x2={view.tx} className="sk-axis" />

          {ghosts.map((g, i) => <path key={i} d={pathOf(g.pts.map(W2S))} className={g.kind === 'base' ? 'sk-base' : 'sk-ghost'} />)}
          {p.baseDim && opts.dims && (() => {
            const a = W2S(p.baseDim.a), b = W2S(p.baseDim.b), y = a[1] + 22, txt = fmt(p.baseDim.value, 2), w = txt.length * 7.2 + 14;
            return <g className="sk-dim base" data-role="base"><line x1={a[0]} x2={b[0]} y1={y} y2={y} className="sk-dimline" /><line x1={a[0]} x2={a[0]} y1={a[1] + 4} y2={y + 5} className="sk-dimline" /><line x1={b[0]} x2={b[0]} y1={b[1] + 4} y2={y + 5} className="sk-dimline" />
              <rect x={(a[0] + b[0]) / 2 - w / 2} y={y - 9} width={w} height={18} rx={4} /><text x={(a[0] + b[0]) / 2} y={y + 1}>{txt}</text></g>;
          })()}

          {overall && <g className="sk-overall">
            <line x1={overall.x0} x2={overall.x1} y1={overall.y1 + 46} y2={overall.y1 + 46} /><line x1={overall.x0} x2={overall.x0} y1={overall.y1 + 40} y2={overall.y1 + 52} /><line x1={overall.x1} x2={overall.x1} y1={overall.y1 + 40} y2={overall.y1 + 52} />
            <text x={(overall.x0 + overall.x1) / 2} y={overall.y1 + 64}>{fmt(overall.w, 2)} {unit}</text>
            <line x1={overall.x1 + 46} x2={overall.x1 + 46} y1={overall.y0} y2={overall.y1} /><line x1={overall.x1 + 40} x2={overall.x1 + 52} y1={overall.y0} y2={overall.y0} /><line x1={overall.x1 + 40} x2={overall.x1 + 52} y1={overall.y1} y2={overall.y1} />
            <text x={overall.x1 + 56} y={(overall.y0 + overall.y1) / 2} className="v">{fmt(overall.h, 2)} {unit}</text>
          </g>}

          <path d={pathOf(chainScr)} className="sk-chain" />
          {G.segs.filter(g => !g.ok).map(g => <circle key={'bad' + g.i} cx={L2S(g.a)[0]} cy={L2S(g.a)[1]} r={7} className="sk-bad" />)}
          {sel !== null && G.segs[sel] && <path d={pathOf(G.segs[sel].pts.map(L2S))} className="sk-selected" />}
          {hems.map(h => <text key={'h' + h.i} x={h.q[0] + 8} y={h.q[1] - 8} className="sk-hem">ZAV</text>)}
          {angs.map(a => <g key={'a' + a.i} className="sk-ang"><path d={a.d} /><text x={a.x} y={a.y}>{a.txt}</text></g>)}

          {G.segs.map(g => <path key={'hit' + g.i} d={pathOf(g.pts.map(L2S))} className="sk-hit" data-role="seg" data-i={g.i} />)}
          {dims.map(d => <g key={'d' + d.i} className={`sk-dim${sel === d.i ? ' on' : ''}`} data-role="dim" data-i={d.i}>
            <rect x={d.x - d.w / 2} y={d.y - 9} width={d.w} height={18} rx={4} /><text x={d.x} y={d.y + 1}>{d.txt}</text></g>)}

          {tool === 'select' && G.segs.map(g => g.kind === 'line' && g.ok ? (() => { const q = L2S(g.b); return <rect key={'v' + g.i} x={q[0] - 4.5} y={q[1] - 4.5} width={9} height={9} className={`sk-handle${sel === g.i ? ' on' : ''}`} data-role="v" data-i={g.i} />; })() : null)}

          {(tool === 'line' || tool === 'arc') && <>
            {p.canPrepend && segs.length > 0 && tool === 'line' && (() => { const q = L2S([0, 0]); return <circle cx={q[0]} cy={q[1]} r={fromStart ? 7 : 5} className={`sk-anchor${fromStart ? ' on' : ''}`} data-role="start"><title>Boshidan davom ettirish</title></circle>; })()}
            {placed && (() => { const q = L2S(G.end); return <circle cx={q[0]} cy={q[1]} r={!fromStart ? 7 : 5} className={`sk-anchor${!fromStart ? ' on' : ''}`} data-role="end"><title>Oxiridan davom ettirish</title></circle>; })()}
          </>}

          {preview && prevB && <>
            {preview.track && (() => { const t = L2S(preview.track); return <line x1={t[0]} y1={t[1]} x2={prevB[0]} y2={prevB[1]} className="sk-track" />; })()}
            <line x1={prevA[0]} y1={prevA[1]} x2={prevB[0]} y2={prevB[1]} className="sk-preview" />
            <circle cx={prevB[0]} cy={prevB[1]} r={4} className="sk-preview-pt" />
          </>}
          {arcGeom && <path d={pathOf(arcGeom.pts.map(L2S))} className="sk-preview" />}
          {lock !== null && tool === 'line' && (() => { const v = [Math.cos(lock * Math.PI / 180), -Math.sin(lock * Math.PI / 180)]; return <line x1={prevA[0]} y1={prevA[1]} x2={prevA[0] + v[0] * 4000} y2={prevA[1] + v[1] * 4000} className="sk-lock" />; })()}

          {curS && (tool === 'line' || tool === 'arc') && !dragging && <g className="sk-cross"><line x1={curS[0] - 10} x2={curS[0] + 10} y1={curS[1]} y2={curS[1]} /><line x1={curS[0]} x2={curS[0]} y1={curS[1] - 10} y2={curS[1] + 10} /></g>}
        </svg>

        {tipTxt && (curS || typed) && <div className="sk-tip" style={{ left: (curS ? curS[0] : prevA[0]) + 16, top: (curS ? curS[1] : prevA[1]) + 16 }}>
          {tipTxt}{typed && <div className="typed">⌨ {typed}<span className="caret" /></div>}
        </div>}
        {edit && <input className="sk-edit" autoFocus style={{ left: edit.x, top: edit.y }} value={edit.v}
          onFocus={e => e.currentTarget.select()}
          onChange={e => setEdit({ ...edit, v: e.target.value })}
          onKeyDown={e => { if (e.key === 'Enter') applyEdit(edit); else if (e.key === 'Escape') setEdit(null); e.stopPropagation(); }}
          onBlur={() => applyEdit(edit)} aria-label="Oʻlcham qiymati" />}
        {empty && tool === 'line' && !typed && <div className="sk-empty">
          <b>Kesimni chizing</b>
          <span>Belgilangan nuqtadan boshlab bosing, yoki uzunlikni yozib Enter bosing.<br />Strelka tugmalari yoʻnalishni qotiradi: ↑ 20 Enter → 20 Enter …</span>
        </div>}
        {lock !== null && tool === 'line' && <div className="sk-chip">Yoʻnalish qotirilgan: {['→', '↑', '←', '↓'][lock / 90]} · Esc — bekor</div>}
        {fromStart && tool === 'line' && <div className="sk-chip" style={{ top: lock !== null ? 44 : 12 }}>Kesim boshidan chizilmoqda</div>}
      </div>

      <div className="sk-status">
        <span className="hint">{HINT[tool]}</span>
        <span className="coords">{curLoc ? `X ${fmt(curLoc[0], 2)}  Y ${fmt(curLoc[1], 2)}` : ''}</span>
        <label title="Burchak qadami">∠<select value={opts.angStep} onChange={e => setOpts({ ...opts, angStep: +e.target.value })}>{ANG_STEPS.map(a => <option key={a} value={a}>{a}°</option>)}</select></label>
        <label title="Uzunlik qadami">↔<select value={opts.lenStep} onChange={e => setOpts({ ...opts, lenStep: +e.target.value })}>{(LEN_STEPS[unit] || LEN_STEPS.mm).map(a => <option key={a} value={a}>{a} {unit}</option>)}</select></label>
        {([['grid', 'Toʻr'], ['track', 'Kuzatish'], ['dims', 'Oʻlchamlar'], ['angles', 'Burchaklar'], ['overall', 'Gabarit']] as [keyof SketchOpts, string][]).map(([k, l]) =>
          <button key={k} className={`tg${opts[k] ? ' on' : ''}`} onClick={() => setOpts({ ...opts, [k]: !opts[k] })}>{l}</button>)}
      </div>
    </div>
  );
}
