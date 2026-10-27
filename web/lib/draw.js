// @ts-nocheck
/* SVG chizmalar (legacy/index.html dan). Barcha matnlar esc() bilan ekranlangan. */
import Core from "./core";
const C = Core, fmt = Core.fmt;
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
/** Kesim chizmasi (segment oʻlchamlari, umumiy eni/boʻyi) */
export function profileSVG(pr, title, Wd = 900, Hd = 480) {
  const xs = pr.pts.map(p => p[0]), ys = pr.pts.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const pad = 80, k = Math.min((Wd - 2 * pad) / Math.max(x1 - x0, 1e-6), (Hd - 2 * pad) / Math.max(y1 - y0, 1e-6), 50);
  const ox = (Wd - (x1 - x0) * k) / 2 - x0 * k, oy = (Hd + (y1 - y0) * k) / 2 + y0 * k, X = x => ox + x * k, Y = y => oy - y * k;
  let s = `<svg viewBox="0 0 ${Wd} ${Hd}" xmlns="http://www.w3.org/2000/svg" font-family="ui-monospace,Consolas,monospace">`;
  s += `<polyline points="${pr.pts.map(p => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(' ')}" fill="none" stroke="#111" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`;
  pr.labels.forEach(l => { const tx = X(l.x) + l.n[0] * 22, ty = Y(l.y) - l.n[1] * 22; s += `<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" font-size="20" text-anchor="middle" dominant-baseline="middle" fill="#1a5fd0">${esc(l.txt)}</text>`; });
  const f = pr.f, red = '#d0312d', bx = X(x0), bX = X(x1), by = Y(y1), bY = Y(y0);
  s += `<line x1="${bx}" y1="${by - 30}" x2="${bX}" y2="${by - 30}" stroke="${red}"/><line x1="${bx}" y1="${by - 36}" x2="${bx}" y2="${by - 24}" stroke="${red}"/><line x1="${bX}" y1="${by - 36}" x2="${bX}" y2="${by - 24}" stroke="${red}"/><text x="${(bx + bX) / 2}" y="${by - 40}" font-size="20" text-anchor="middle" fill="${red}">${fmt((x1 - x0) / f, 2)}</text>`;
  s += `<line x1="${bX + 30}" y1="${by}" x2="${bX + 30}" y2="${bY}" stroke="${red}"/><line x1="${bX + 24}" y1="${by}" x2="${bX + 36}" y2="${by}" stroke="${red}"/><line x1="${bX + 24}" y1="${bY}" x2="${bX + 36}" y2="${bY}" stroke="${red}"/><text x="${bX + 42}" y="${(by + bY) / 2}" font-size="20" fill="${red}" dominant-baseline="middle">${fmt((y1 - y0) / f, 2)}</text>`;
  s += `<text x="12" y="${Hd - 14}" font-size="18" fill="#3b4557">${esc(title)} · eni ${fmt((x1 - x0) / f, 2)} × boʻyi ${fmt((y1 - y0) / f, 2)} ${pr.unit} · yoyilma ${fmt(pr.W, 2)} mm</text></svg>`;
  return s;
}
export const lineLabel = (l, f) => l.kind === 'hem' ? `ZAV ${l.turn > 0 ? '↺' : '↻'}180°` : l.kind === 'arc' ? `yoy R${fmt(l.r / f)}` : `${l.turn > 0 ? '↑' : '↓'}${fmt(Math.abs(l.turn))}°`;
/** Toʻrtburchak polosa yoyilmasi: eni gorizontal, bukish chiziqlari (uzunlik qisqartirilgan) */
export function stripSVG(pt, it) {
  const pr = pt.prW, W = pt.Y, Ld = Math.min(pt.X, Math.max(W * 0.45, 40)), Wd = 960, pad = 50, k = (Wd - 2 * pad) / W, top = 90, bot = top + Ld * k, Hd = Ld * k + 190, X = y => pad + y * k;
  let s = `<svg viewBox="0 0 ${Wd} ${Hd}" xmlns="http://www.w3.org/2000/svg" font-family="ui-monospace,Consolas,monospace">`;
  s += `<rect x="${X(0)}" y="${top}" width="${W * k}" height="${Ld * k}" fill="#eef4fd" stroke="#d0312d" stroke-width="2"/>`;
  const cuts = [0, ...pr.lines.map(l => l.y), W];
  pr.lines.forEach((l, i) => { const x = X(l.y), col = l.kind === 'hem' ? '#c42b1c' : l.kind === 'arc' ? '#9b59b6' : '#18794e'; s += `<line x1="${x}" y1="${top}" x2="${x}" y2="${bot}" stroke="${col}" stroke-dasharray="7 4" stroke-width="1.6"/><text x="${x}" y="${top - 12 - (i % 2) * 24}" font-size="19" text-anchor="middle" fill="${col}">${esc(lineLabel(l, pr.f))}</text>`; });
  for (let i = 0; i + 1 < cuts.length; i++) { const a = X(cuts[i]), b = X(cuts[i + 1]); s += `<text x="${(a + b) / 2}" y="${bot + 26 + (i % 2) * 22}" font-size="19" text-anchor="middle" fill="#1a5fd0">${fmt(cuts[i + 1] - cuts[i], 2)}</text>`; }
  s += `<line x1="${X(0)}" y1="${bot + 76}" x2="${X(W)}" y2="${bot + 76}" stroke="#d0312d"/><text x="${X(W / 2)}" y="${bot + 102}" font-size="22" text-anchor="middle" fill="#d0312d" font-weight="700">YOYILMA ENI = ${fmt(W, 2)} mm · uzunligi ${fmt(pt.X, 0)} mm (rasmda qisqartirilgan)</text></svg>`;
  return s;
}
/** 4 tomonli detal yoyilmasi (haqiqiy proporsiya) */
export function traySVG(pt) {
  const Wd = 960, pad = 70, k = Math.min((Wd - 2 * pad) / pt.X, 620 / pt.Y), Hd = pt.Y * k + 2 * pad, X = x => pad + x * k, Y = y => pad + (pt.Y - y) * k;
  let s = `<svg viewBox="0 0 ${Wd} ${Hd}" xmlns="http://www.w3.org/2000/svg" font-family="ui-monospace,Consolas,monospace">`;
  s += `<polygon points="${(pt.outline || [[0, 0], [pt.X, 0], [pt.X, pt.Y], [0, pt.Y]]).map(p => `${X(p[0])},${Y(p[1])}`).join(' ')}" fill="#eef4fd" stroke="#d0312d" stroke-width="2"/>`;
  pt.bends.forEach(b => { const col = b.l.kind === 'hem' ? '#c42b1c' : b.l.kind === 'arc' ? '#9b59b6' : '#18794e'; s += `<line x1="${X(b.a[0])}" y1="${Y(b.a[1])}" x2="${X(b.b[0])}" y2="${Y(b.b[1])}" stroke="${col}" stroke-dasharray="7 4" stroke-width="1.5"/>`; });
  // eni boʻyicha (chap tomonda) va boʻyi boʻyicha (pastda) oʻlchamlar
  const ys = [0, ...pt.prW.lines.map(l => l.y), pt.Y], xs = [0, ...pt.prL.lines.map(l => l.y), pt.X];
  for (let i = 0; i + 1 < ys.length; i++) s += `<text x="${X(0) - 8}" y="${(Y(ys[i]) + Y(ys[i + 1])) / 2}" font-size="15" text-anchor="end" dominant-baseline="middle" fill="#1a5fd0">${fmt(ys[i + 1] - ys[i], 1)}</text>`;
  for (let i = 0; i + 1 < xs.length; i++) s += `<text x="${(X(xs[i]) + X(xs[i + 1])) / 2}" y="${Y(0) + 20 + (i % 2) * 18}" font-size="15" text-anchor="middle" fill="#1a5fd0">${fmt(xs[i + 1] - xs[i], 1)}</text>`;
  pt.prW.lines.forEach(l => s += `<text x="${X(pt.x1) + 6}" y="${Y(l.y)}" font-size="14" dominant-baseline="middle" fill="#18794e">${esc(lineLabel(l, pt.prW.f))}</text>`);
  pt.prL.lines.forEach((l, i) => s += `<text x="${X(l.y)}" y="${Y(pt.y1) - 8 - (i % 2) * 16}" font-size="14" text-anchor="middle" fill="#18794e">${esc(lineLabel(l, pt.prL.f))}</text>`);
  s += `<text x="${X(pt.X / 2)}" y="${Hd - 8}" font-size="20" text-anchor="middle" fill="#d0312d" font-weight="700">${fmt(pt.X, 2)} × ${fmt(pt.Y, 2)} mm</text></svg>`;
  return s;
}
/** List xaritasi: X — rulon boʻylab, Y — eni */
export function sheetSVG(sh) {
  const L = sh.usedLen, H = sh.SW, Wd = 1200, k = Wd / Math.max(L, 1), Hd = H * k + 40, X = x => x * k, Y = y => 20 + (H - y) * k;
  let s = `<svg viewBox="0 0 ${Wd + 2} ${Hd}" xmlns="http://www.w3.org/2000/svg" font-family="system-ui,Arial,sans-serif">`;
  s += `<rect x="0" y="20" width="${L * k}" height="${H * k}" fill="#e9edf2" stroke="#7a8496"/>`;
  sh.placements.forEach(q => {
    const f = C.placeFn(q), pts = (q.s.outline || [[0, 0], [q.s.X, 0], [q.s.X, q.s.Y], [0, q.s.Y]]).map(f);
    s += `<polygon points="${pts.map(p => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(' ')}" fill="#cfe0fb" stroke="#d0312d" stroke-width="1"/>`;
    q.s.bends.forEach(b => { const a = f(b.a), c = f(b.b); s += `<line x1="${X(a[0])}" y1="${Y(a[1])}" x2="${X(c[0])}" y2="${Y(c[1])}" stroke="#18794e" stroke-opacity=".45" stroke-dasharray="4 3"/>`; });
    const fs = Math.max(12, Math.min(26, Math.min(q.h, q.w / 8) * k * 0.6));
    s += `<text x="${X(q.x + q.w / 2)}" y="${Y(q.y + q.h / 2)}" font-size="${fs}" text-anchor="middle" dominant-baseline="middle" fill="#1b2330">${esc(q.s.id)} · ${fmt(q.s.Y, 1)}×${fmt(q.s.X, 0)}</text>`;
  });
  s += `<text x="0" y="14" font-size="13" fill="#3b4557">List: ${fmt(L, 0)} × ${fmt(H, 0)} mm (rulon boʻylab ${fmt(L, 0)} mm kesiladi)</text></svg>`;
  return s;
}
export function dxfSVG(R) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; const ad = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
  R.ents.forEach(e => { if (e.type === 'LINE') { ad(e.x, e.y); ad(e.x2, e.y2); } else (e.verts || []).forEach(v => ad(v.x, v.y)); });
  if (!isFinite(x0)) return '<div class="note">Boʻsh DXF</div>';
  const k = Math.min(1200 / Math.max(x1 - x0, 1), 700 / Math.max(y1 - y0, 1)), Hd = (y1 - y0) * k + 20, X = x => (x - x0) * k + 1, Y = y => 10 + (y1 - y) * k;
  const col = { CUT: '#d0312d', BEND: '#18794e', LABEL: '#222', SHEET: '#999' };
  let s = `<svg viewBox="0 0 ${(x1 - x0) * k + 2} ${Hd}" xmlns="http://www.w3.org/2000/svg">`;
  R.ents.forEach(e => {
    const c = col[e.layer] || '#222';
    if (e.type === 'LINE') s += `<line x1="${X(e.x)}" y1="${Y(e.y)}" x2="${X(e.x2)}" y2="${Y(e.y2)}" stroke="${c}" stroke-width="${e.layer === 'CUT' ? 1.3 : .8}"/>`;
    else s += `<polygon points="${e.verts.map(v => `${X(v.x)},${Y(v.y)}`).join(' ')}" fill="none" stroke="${c}" stroke-width="1.3"/>`;
  });
  return s + '</svg>';
}

