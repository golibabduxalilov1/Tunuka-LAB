'use client';
import { useState } from 'react';
import Core from '@/lib/core';
import { Seg, chainGeom, normAng, toNum, parseCommand, toCommand } from '@/lib/sketch';
import { SIDE_EDITORS, setSideMode, convertUnit } from '@/lib/model';
import { Icon } from './Icons';
import SideModePicker from './SideModes';
const C: any = Core;
const fmt = C.fmt;

type Props = {
  P: any; it: any; pt: any; err?: string; U: string;
  upd: (fn: (p: any) => void, tag?: string) => void;
  updItem: (fn: (it: any) => void, tag?: string) => void;
  editKey: string; setEditKey: (k: string) => void;
  segs: Seg[]; setSegs: (s: Seg[], tag?: string) => void; d0: number | null; mirror: boolean; hv: number;
  sel: number | null; setSel: (i: number | null) => void;
};

const DIR_BTNS: [number, string][] = [[135, '↖'], [90, '↑'], [45, '↗'], [180, '←'], [-1, ''], [0, '→'], [225, '↙'], [270, '↓'], [315, '↘']];

/** Yoʻnalishni koʻrsatuvchi kichik strelka (ekrandagi burchak boʻyicha) */
const Arrow = ({ deg }: { deg: number }) => (
  <svg width="14" height="14" viewBox="-7 -7 14 14" style={{ transform: `rotate(${-deg}deg)` }} aria-hidden><path d="M-5 0H5M2 -3L5 0L2 3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

export default function Inspector(p: Props) {
  const { P, it, pt, err, U, updItem, segs, setSegs, sel, setSel, mirror } = p;
  const [cmd, setCmd] = useState('');
  const [cmdErr, setCmdErr] = useState('');
  const [showCalc, setShowCalc] = useState(false);
  const scr = (a: number) => (mirror ? normAng(180 - a) : normAng(a));
  const G = chainGeom(segs, p.d0, p.hv);
  const s = sel !== null ? segs[sel] : null, g = sel !== null ? G.segs[sel] : null;
  const setSeg = (patch: Partial<Seg>, tag: string) => setSegs(segs.map((x, j) => {
    if (j !== sel) return x;
    const n: Seg = { ...x, ...patch };
    if ('ang' in patch) delete n.dir;
    return n;
  }), tag);
  const move = (i: number, j: number) => { if (j < 0 || j >= segs.length) return; const a = segs.slice(); [a[i], a[j]] = [a[j], a[i]]; setSegs(a); setSel(j); };
  const editors = it.type === 'tray' ? (SIDE_EDITORS[it.sideMode] as [string, string][]) : [];

  return (
    <div className="insp">
      <section>
        <h3>Detal {it.id}</h3>
        <div className="fields">
          <label className="f wide">Nomi<input value={it.name} onChange={e => updItem(x => { x.name = e.target.value; }, 'name')} /></label>
          <label className="f">Soni, dona<input type="number" min={0} step={1} value={it.qty} onChange={e => updItem(x => { x.qty = e.target.value; }, 'qty')} /></label>
          {it.type === 'tray' && it.sideMode[0] === '4'
            ? <label className="f">Taglik boʻyi, {U}<input type="number" step="any" value={it.baseL} onChange={e => updItem(x => { x.baseL = e.target.value; }, 'baseL')} /></label>
            : <label className="f">Uzunligi, mm<input type="number" min={1} step={1} value={it.len} onChange={e => updItem(x => { x.len = e.target.value; }, 'len')} /></label>}
          {it.type === 'tray' && <>
            <label className="f">Taglik eni, {U}<input type="number" step="any" value={it.base} onChange={e => updItem(x => { x.base = e.target.value; }, 'base')} /></label>
            <div className="f wide">Bukiladigan tomonlar
              <SideModePicker value={it.sideMode} onChange={m => { updItem(x => setSideMode(x, m)); p.setEditKey((SIDE_EDITORS[m] as [string, string][])[0][0]); }} />
              <span className="muted tiny">Bir xil rangdagi tomonlar bir xil profilga ega. Tomonni tanlab chizmada chizing.</span>
            </div>
          </>}
          <label className="f">Kesim birligi<select value={P.unit} onChange={e => { const u = e.target.value; p.upd(q => convertUnit(q, u)); }}><option value="sm">sm</option><option value="mm">mm</option></select></label>
        </div>
        {editors.length > 1 && <div className="seg-ctl" role="tablist" aria-label="Tahrirlanayotgan tomon">
          {editors.map(([k, t]) => <button key={k} role="tab" aria-selected={p.editKey === k} className={p.editKey === k ? 'on' : ''} onClick={() => { p.setEditKey(k); setSel(null); }}>{t.replace(' tomonlar', '').replace(' tomon', '')}</button>)}
        </div>}
      </section>

      <section>
        <h3>{s ? `Segment ${sel! + 1}` : 'Segment'}</h3>
        {!s || !g ? <p className="muted small">Chizmada segmentni bosing yoki pastdagi roʻyxatdan tanlang.</p> : s.t === 'arc' ? (
          <div className="fields">
            <label className="f">Radius, {U}<input type="number" step="any" value={s.r ?? ''} onChange={e => setSeg({ r: e.target.value }, 'r' + sel)} /></label>
            <label className="f">Burchak, °<input type="number" step="any" value={s.a ?? ''} onChange={e => setSeg({ a: e.target.value }, 'a' + sel)} /></label>
            <label className="f wide">Yoʻnalish<select value={s.side === 'R' ? 'R' : 'L'} onChange={e => setSeg({ side: e.target.value as 'L' | 'R' }, '')}><option value="L">Chapga (soat mili teskari)</option><option value="R">Oʻngga (soat mili boʻyicha)</option></select></label>
            <div className="kvline wide"><span>Yoy uzunligi</span><b>{fmt(g.L, 2)} {U}</b></div>
          </div>
        ) : (
          <div className="fields">
            <label className="f">Uzunligi, {U}<input type="number" step="any" value={s.L ?? ''} onChange={e => setSeg({ L: e.target.value }, 'L' + sel)} autoFocus={false} /></label>
            <label className="f">Burchak, °<input type="number" step="any" value={C.segDir(s) === undefined ? '' : fmt(scr(C.segDir(s)), 3)} onChange={e => { const v = toNum(e.target.value); if (isFinite(v)) setSeg({ ang: mirror ? normAng(180 - v) : normAng(v) }, 'ang' + sel); }} /></label>
            <div className="dirpad wide" aria-label="Yoʻnalish">
              {DIR_BTNS.map(([a, l], k) => a < 0 ? <span key={k} className="mid">{g.turn !== null && Math.abs(g.turn) > 0.01 ? `∠${fmt(180 - Math.abs(g.turn), 1)}°` : '—'}</span>
                : <button key={k} className={Math.abs(scr(g.dir) - a) < 1e-6 ? 'on' : ''} onClick={() => setSeg({ ang: mirror ? normAng(180 - a) : a }, '')}>{l}</button>)}
            </div>
            {g.hem && <label className="f wide">Zavaltsovka tomoni<select value={s.side === 'R' ? 'R' : 'L'} onChange={e => setSeg({ side: e.target.value as 'L' | 'R' }, '')}><option value="L">Chap</option><option value="R">Oʻng</option></select></label>}
          </div>
        )}
        {s && <div className="row tight" style={{ marginTop: 8 }}>
          <button className="sm" onClick={() => move(sel!, sel! - 1)} disabled={sel === 0}>↑ Yuqoriga</button>
          <button className="sm" onClick={() => move(sel!, sel! + 1)} disabled={sel === segs.length - 1}>↓ Pastga</button>
          <span className="spacer" />
          <button className="sm danger" onClick={() => { setSegs(segs.filter((_, j) => j !== sel)); setSel(null); }}>Oʻchirish</button>
        </div>}
      </section>

      <section>
        <h3>Segmentlar <span className="count">{segs.length}</span></h3>
        {segs.length ? <table className="segs"><tbody>
          {G.segs.map(q => {
            const x = segs[q.i];
            return <tr key={q.i} className={`${sel === q.i ? 'sel' : ''}${q.ok ? '' : ' bad'}`} onClick={() => setSel(q.i)}>
              <td className="n">{q.i + 1}</td>
              <td>{x.t === 'arc' ? <span className="small">yoy {x.side === 'R' ? '↻' : '↺'}</span> : <Arrow deg={scr(q.dir)} />}</td>
              <td className="num">{x.t === 'arc' ? `R${fmt(toNum(x.r), 2)} · ${fmt(toNum(x.a), 1)}°` : `${fmt(toNum(x.L), 2)} ${U}`}</td>
              <td className="num muted">{q.hem ? 'ZAV' : q.turn !== null && Math.abs(q.turn) > 0.01 && x.t !== 'arc' ? `∠${fmt(180 - Math.abs(q.turn), 1)}°` : ''}</td>
            </tr>;
          })}
        </tbody></table> : <p className="muted small">{it.type === 'tray' ? 'Bu tomon bukilmaydi (boʻsh).' : 'Hali segment yoʻq.'}</p>}
        <div className="cmd">
          <input placeholder="Buyruq: ↑20 ←20 ↑20 yoki 20<90 20<180" value={cmd} onChange={e => { setCmd(e.target.value); setCmdErr(''); }}
            onKeyDown={e => { if (e.key === 'Enter') { const r = parseCommand(cmd); if (!r) { setCmdErr('Format: ↑20 ←15 yoki 20<90 (uzunlik<burchak)'); return; } setSegs(r); setSel(null); setCmd(''); } }} aria-label="Matnli buyruq" />
          <button className="sm" title="Joriy kesimni matnga nusxalash" onClick={() => { setCmd(toCommand(segs)); setCmdErr(''); }}><Icon name="copy" size={15} /></button>
        </div>
        {cmdErr && <div className="msg err">{cmdErr}</div>}
        <p className="muted tiny">Enter — kesimni buyruq boʻyicha qayta yaratadi.</p>
      </section>

      <section>
        <h3>Natija</h3>
        {err ? <div className="msg err"><Icon name="warn" size={15} /> {err}</div> : pt && <>
          <div className="result">
            <span className="lbl">Yoyilma</span>
            <span className="val">{fmt(pt.Y, 2)} <small>×</small> {fmt(pt.X, 2)} <small>mm</small></span>
            <span className="sub">bukishlar: {pt.bends.filter((b: any) => b.l.kind !== 'arc').length}{pt.outline ? ' · burchaklari kesiladi' : ''} · {it.qty} dona</span>
          </div>
          {pt.warns.map((w: string, i: number) => <div key={i} className="msg warn">{w}</div>)}
          <button className="link" onClick={() => setShowCalc(!showCalc)}>{showCalc ? 'Hisobni yashirish' : 'Hisobni koʻrsatish'}</button>
          {showCalc && <pre className="calc">{pt.rows.join('\n')}</pre>}
        </>}
      </section>
    </div>
  );
}
