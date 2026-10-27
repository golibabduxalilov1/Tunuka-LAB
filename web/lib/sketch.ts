/* Chizma geometriyasi: segmentlar zanjiri → nuqtalar, snap, kuzatish chiziqlari. DOM ga bogʻliq emas. */
import Core from './core';
const C: any = Core;

export const D2R = Math.PI / 180;
export type Pt = [number, number];
export type Seg = { dir?: string; ang?: number | string; L?: number | string; t?: 'arc'; side?: 'L' | 'R'; a?: number | string; r?: number | string };

export const normAng = (a: number) => ((a % 360) + 360) % 360;
export const normTurn = (t: number) => ((t % 360) + 540) % 360 - 180;
export const round = (v: number, step: number) => Math.round(v / step) * step;
export const clean = (v: number) => +v.toFixed(4);
export const toNum = (v: unknown) => Number(String(v ?? '').replace(',', '.'));
export const unitVec = (deg: number): Pt => [Math.cos(deg * D2R), Math.sin(deg * D2R)];
export const dist = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1]);

/** Segment yoʻnalishi gradusda (null — notoʻgʻri) */
export function segAngle(s: Seg): number | null {
  const a = C.segDir(s);
  return a === undefined ? null : a;
}

export type GSeg = {
  i: number; kind: 'line' | 'arc'; ok: boolean;
  a: Pt; b: Pt; pts: Pt[];
  dir: number; prevDir: number | null; turn: number | null; L: number; hem: boolean;
  c?: Pt; r?: number; sweep?: number;
};

/**
 * Zanjir geometriyasi lokal koordinatada (0,0 dan boshlanadi).
 * d0 — zanjirdan oldingi yoʻnalish (tomon uchun taglik: 0°), erkin kesim uchun null.
 * hv — zavaltsovka (180°) chizmadagi koʻrinma oraligʻi.
 */
export function chainGeom(segs: Seg[], d0: number | null, hv: number) {
  let p: Pt = [0, 0], d: number | null = d0;
  const out: GSeg[] = [];
  segs.forEach((s, i) => {
    if (s.t === 'arc') {
      const r = toNum(s.r), a = toNum(s.a);
      const ok = d !== null && r > 0 && a > 0 && a <= 180;
      if (!ok || d === null) { out.push({ i, kind: 'arc', ok: false, a: p, b: p, pts: [p], dir: d ?? 0, prevDir: d, turn: null, L: 0, hem: false }); return; }
      const sweep = s.side === 'R' ? -a : a, sg = Math.sign(sweep), u = unitVec(d);
      const c: Pt = [p[0] - u[1] * r * sg, p[1] + u[0] * r * sg], th0 = Math.atan2(p[1] - c[1], p[0] - c[0]);
      const n = Math.max(6, Math.ceil(a / 5)), pts: Pt[] = [p];
      for (let k = 1; k <= n; k++) { const th = th0 + sweep * D2R * k / n; pts.push([c[0] + r * Math.cos(th), c[1] + r * Math.sin(th)]); }
      const b = pts[pts.length - 1];
      out.push({ i, kind: 'arc', ok: true, a: p, b, pts, dir: d, prevDir: d, turn: sweep, L: r * a * D2R, hem: false, c, r, sweep });
      p = b; d = d + sweep; return;
    }
    const dir = segAngle(s), L = toNum(s.L);
    if (dir === null) { out.push({ i, kind: 'line', ok: false, a: p, b: p, pts: [p, p], dir: d ?? 0, prevDir: d, turn: null, L: 0, hem: false }); return; }
    let turn = d === null ? null : normTurn(dir - d), hem = false, a = p;
    if (turn !== null && Math.abs(Math.abs(turn) - 180) < 1e-9 && d !== null) {
      const sg = s.side === 'R' ? -1 : 1, u = unitVec(d);
      a = [p[0] - u[1] * hv * sg, p[1] + u[0] * hv * sg]; turn = 180 * sg; hem = true;
    }
    const ok = L > 0, Lv = ok ? L : 0, u = unitVec(dir), b: Pt = [a[0] + u[0] * Lv, a[1] + u[1] * Lv];
    out.push({ i, kind: 'line', ok, a, b, pts: [a, b], dir, prevDir: d, turn, L: Lv, hem });
    p = b; d = dir;
  });
  return { segs: out, end: p, endDir: d };
}

export type Snap = { ang: number; L: number; end: Pt; track: Pt | null };

/**
 * Kursor boʻyicha yangi segment: burchak qadami angStep (free — 1°), uzunlik qadami lenStep.
 * lock — qatʼiy yoʻnalish (klaviatura strelkalari). targets — kuzatish uchun nuqtalar (x yoki y bir xil boʻlsa tortiladi).
 */
export function snapSeg(anchor: Pt, cur: Pt, o: { angStep: number; lenStep: number; free?: boolean; lock?: number | null; targets?: Pt[]; tol?: number }): Snap {
  const v: Pt = [cur[0] - anchor[0], cur[1] - anchor[1]];
  const raw = normAng(Math.atan2(v[1], v[0]) / D2R);
  const ang = o.lock ?? normAng(o.free ? Math.round(raw) : round(raw, o.angStep));
  const u = unitVec(ang), proj = Math.max(0, v[0] * u[0] + v[1] * u[1]);
  let L = Math.max(0, round(proj, o.lenStep)), track: Pt | null = null;
  if (o.targets && o.tol) {
    let best = o.tol;
    for (const q of o.targets) {
      for (const ax of [0, 1] as const) {
        if (Math.abs(u[ax]) < 1e-6) continue;
        const t = (q[ax] - anchor[ax]) / u[ax];
        if (t > 1e-6 && Math.abs(t - proj) < best) { best = Math.abs(t - proj); L = t; track = q; }
      }
    }
  }
  L = clean(L);
  return { ang: clean(ang), L, end: [anchor[0] + u[0] * L, anchor[1] + u[1] * L], track };
}

/** Kursor orqali oʻtuvchi, uchidagi yoʻnalishga urinma yoy */
export function snapArc(anchor: Pt, dir: number, cur: Pt, o: { angStep: number; lenStep: number; free?: boolean }) {
  const u = unitVec(dir), n: Pt = [-u[1], u[0]], v: Pt = [cur[0] - anchor[0], cur[1] - anchor[1]];
  const dn = v[0] * n[0] + v[1] * n[1], du = v[0] * u[0] + v[1] * u[1], c = Math.hypot(v[0], v[1]);
  if (c < 1e-9 || Math.abs(dn) < 1e-9) return null;
  let sw = Math.abs(2 * Math.atan2(Math.abs(dn), du) / D2R);
  sw = Math.min(180, Math.max(o.free ? 1 : o.angStep, o.free ? Math.round(sw) : round(sw, o.angStep)));
  const r = Math.max(o.lenStep, clean(round(c / (2 * Math.sin(sw * D2R / 2)), o.lenStep)));
  return { t: 'arc' as const, side: (dn > 0 ? 'L' : 'R') as 'L' | 'R', a: clean(sw), r };
}

/** Oʻqib boʻladigan burchak yozuvi */
export const angLabel = (deg: number) => `${C.fmt(normAng(deg), 1)}°`;

/** Matn buyrugʻi: "↑20 ←20 ↑20" yoki "20<90 20<180" */
const ARROWS: Record<string, string> = { '↑': 'U', '↓': 'D', '←': 'L', '→': 'R', '↗': 'UR', '↘': 'DR', '↙': 'DL', '↖': 'UL' };
export function parseCommand(txt: string): Seg[] | null {
  const out: Seg[] = [];
  const re = /(↑|↓|←|→|↗|↘|↙|↖|UR|UL|DR|DL|U|D|L|R)\s*([0-9]+(?:[.,][0-9]+)?)|([0-9]+(?:[.,][0-9]+)?)\s*[<@]\s*(-?[0-9]+(?:[.,][0-9]+)?)/gi;
  let m: RegExpExecArray | null, any = false;
  while ((m = re.exec(txt))) {
    any = true;
    if (m[1]) out.push({ dir: ARROWS[m[1]] || m[1].toUpperCase(), L: toNum(m[2]) });
    else out.push({ ang: normAng(toNum(m[4])), L: toNum(m[3]) });
  }
  return any ? out : null;
}

/** Zanjirni matn buyrugʻiga aylantirish (nusxa olish uchun) */
export function toCommand(segs: Seg[]): string {
  return segs.map(s => {
    if (s.t === 'arc') return `yoy ${s.side === 'R' ? 'oʻngga' : 'chapga'} ${s.a}° R${s.r}`;
    const a = segAngle(s);
    const arrow = s.dir && !('ang' in s && s.ang !== undefined && s.ang !== '') ? (C.ARROW as Record<string, string>)[s.dir] : null;
    return arrow ? `${arrow}${s.L}` : `${s.L}<${a === null ? '?' : C.fmt(a, 2)}`;
  }).join('  ');
}
