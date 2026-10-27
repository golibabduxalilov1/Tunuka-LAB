'use client';
import { useMemo, useState } from 'react';
import Core from '@/lib/core';
import { sheetName, sheetDXF, partName, partDXF, checkedDownload } from '@/lib/model';
import { stripSVG, traySVG, sheetSVG, dxfSVG } from '@/lib/draw';
import { Icon } from './Icons';
const C: any = Core;
const fmt = C.fmt;
const Svg = ({ html }: { html: string }) => <div className="svgbox" dangerouslySetInnerHTML={{ __html: html }} />;

/* ---------------- Yoyilma ---------------- */
export function FlatView({ P, R, onOpen }: any) {
  if (!P.items.length) return <Empty text="Detal yoʻq. Chap paneldan qoʻshing." />;
  return <div className="page">
    <PageHead title="Yoyilma" sub="Har bir detalning yassi holati va bukish chiziqlari. ↑/↓ — bukish yoʻnalishi, koʻk raqamlar — bukish chiziqlari orasidagi masofa (mm)." />
    {P.items.map((it: any) => {
      const pt = R.PART.get(it.id);
      if (!pt) return <div key={it.id} className="msg err">{it.id} {it.name}: {R.ERR.get(it.id)}</div>;
      return <div className="card" key={it.id}>
        <div className="card-head">
          <div><b>{it.id} · {it.name}</b> <span className="muted">— {fmt(pt.Y, 2)} × {fmt(pt.X, 2)} mm · {it.qty} dona</span></div>
          <div className="row tight"><span className="tag">bukishlar: {pt.bends.filter((b: any) => b.l.kind !== 'arc').length}</span><button className="sm" onClick={() => onOpen(it.id)}>Chizmada ochish</button></div>
        </div>
        <Svg html={pt.kind === 'tray4' ? traySVG(pt) : stripSVG(pt, it)} />
      </div>;
    })}
  </div>;
}

/* ---------------- List raskroyi ---------------- */
export function NestView({ P, R, name }: any) {
  if (R.NEST_ERR) return <div className="page"><div className="msg err">{R.NEST_ERR}</div></div>;
  const N = R.NEST, sh = N.sheets;
  const area = sh.reduce((s: number, x: any) => s + x.usedLen * x.SW, 0) / 1e6, used = sh.reduce((s: number, x: any) => s + x.area, 0) / 1e6;
  const cut = sh.reduce((s: number, x: any) => s + x.cutLen, 0), pier = sh.reduce((s: number, x: any) => s + x.pierces, 0), m = C.MATERIALS[P.mat] || C.MATERIALS.galv;
  return <div className="page">
    <PageHead title="List raskroyi" sub={`Detal uzunligi rulon boʻylab (X), yoyilma eni rulon eni boʻylab (Y). List eni ${P.sheetW} mm, uzunligi kerakli qadar (maks. ${P.maxLen} mm).`} />
    <div className="stats">
      <Stat l="Listlar" v={sh.length} />
      <Stat l="Rulondan" v={`${fmt(sh.reduce((s: number, x: any) => s + x.usedLen, 0) / 1000, 3)} m`} />
      <Stat l="Maydon" v={`${fmt(area, 3)} m²`} />
      <Stat l="Foydalanish" v={`${area ? fmt(used / area * 100, 1) : 0}%`} />
      <Stat l="Massa" v={`${fmt(area * P.T / 1000 * m.density, 2)} kg`} />
      <Stat l="Kesish" v={`${fmt(cut / 1000, 2)} m`} />
      <Stat l="Vaqt ≈" v={`${fmt(cut / (P.speed * 1000) + pier * P.pierce / 60, 1)} min`} />
    </div>
    {N.unplaced.map((u: any, i: number) => <div key={i} className="msg err">✕ {u.s.id} ×{u.n}: {u.reason}</div>)}
    {R.ERR.size > 0 && <div className="msg err">✕ {R.ERR.size} ta detalda xato — raskroyga kirmadi</div>}
    {!sh.length && <Empty text="Joylash uchun detal yoʻq." />}
    {sh.map((s: any) => {
      const time = s.cutLen / (P.speed * 1000) + s.pierces * P.pierce / 60;
      return <div className="card" key={s.index}>
        <div className="card-head">
          <b>List {s.index} / {sh.length} — {s.usedLen} × {s.SW} mm</b>
          <div className="row tight">{s.verify.length ? <span className="tag err">{s.verify.length} xato</span> : <span className="tag ok">kesishish yoʻq</span>}
            <button className="sm primary" onClick={() => checkedDownload(sheetName(P, name, s), sheetDXF(P, s), s.verify, P.commonLine)}><Icon name="download" size={14} /> DXF</button></div>
        </div>
        <div className="row small muted gap16">
          <span>detallar <b>{s.count}</b></span><span>foydalanish <b>{fmt(s.util, 1)}%</b></span><span>chiqindi <b>{fmt(s.waste / 1e6, 3)} m²</b></span><span>kesish <b>{fmt(s.cutLen / 1000, 2)} m</b></span><span>teshish <b>{s.pierces}</b></span><span>≈ <b>{fmt(time, 1)} min</b></span>
        </div>
        <Svg html={sheetSVG(s)} />
        {s.verify.map((e: string, i: number) => <div key={i} className="msg err">✕ {e}</div>)}
      </div>;
    })}
  </div>;
}

/* ---------------- Eksport: DXF koʻrinishi + tekshiruv ---------------- */
export function ExportView({ P, R, name, onZip }: any) {
  const opts: { v: string; l: string }[] = [
    ...(R.NEST ? R.NEST.sheets.map((sh: any, i: number) => ({ v: 's' + i, l: `List ${sh.index}: ${sh.usedLen}×${sh.SW}` })) : []),
    ...P.items.filter((it: any) => R.PART.has(it.id)).map((it: any) => ({ v: 'p' + it.id, l: `Detal ${it.id} · ${it.name}` })),
  ];
  const [v, setV] = useState(opts[0]?.v ?? '');
  const cur = opts.some(o => o.v === v) ? v : opts[0]?.v ?? '';
  let txt = '', fname = '', extra: string[] = [], openOk = false;
  if (cur[0] === 's') { const sh = R.NEST.sheets[+cur.slice(1)]; txt = sheetDXF(P, sh); fname = sheetName(P, name, sh); extra = sh.verify; openOk = P.commonLine; }
  else if (cur[0] === 'p') { const it = P.items.find((x: any) => x.id === cur.slice(1)), pt = R.PART.get(it.id); txt = partDXF(P, it, pt); fname = partName(name, it, pt); }

  const checks = useMemo(() => {
    const out: { ok: boolean; t: string }[] = [];
    P.items.forEach((it: any) => { const e = R.ERR.get(it.id), pt = R.PART.get(it.id); out.push(e ? { ok: false, t: `${it.id}: ${e}` } : { ok: !pt.warns.length, t: `${it.id} ${it.name}: yoyilma ${fmt(pt.Y, 1)} × ${fmt(pt.X, 0)} mm${pt.warns.length ? ' — ' + pt.warns.join('; ') : ''}` }); });
    R.NEST?.sheets.forEach((sh: any) => { const vv = C.validateDXF(C.parseDXF(sheetDXF(P, sh)), { openOk: P.commonLine }), errs = [...sh.verify, ...vv.issues.map((i: any) => i.msg)]; if (errs.length) errs.forEach((e: string) => out.push({ ok: false, t: `List ${sh.index}: ${e}` })); else out.push({ ok: true, t: `List ${sh.index}: detallar kesishmaydi, list ichida, DXF toza (${sh.count} detal)` }); });
    R.NEST?.unplaced.forEach((u: any) => out.push({ ok: false, t: `${u.s.id} ×${u.n}: ${u.reason}` }));
    return out;
  }, [P, R]);
  const bad = checks.filter(c => !c.ok).length;

  return <div className="page">
    <PageHead title="Eksport" sub="CypCut uchun DXF. Har bir fayl yuklashdan oldin qayta oʻqib tekshiriladi." right={<button className="primary" onClick={onZip}><Icon name="download" size={15} /> Barcha listlar (ZIP)</button>} />
    <div className="card">
      <div className="card-head"><b>Tekshiruv</b>{bad ? <span className="tag err">{bad} ta muammo</span> : <span className="tag ok">hammasi joyida</span>}</div>
      <ul className="checks">{checks.map((c, i) => <li key={i} className={c.ok ? 'ok' : 'err'}><Icon name={c.ok ? 'check' : 'warn'} size={14} /> {c.t}</li>)}</ul>
    </div>
    {!txt ? <Empty text="DXF uchun maʼlumot yoʻq." /> : (() => {
      const parsed = C.parseDXF(txt), val = C.validateDXF(parsed, { openOk }), cnt: Record<string, Record<string, number>> = {};
      parsed.ents.forEach((e: any) => { (cnt[e.layer] ??= {})[e.type] = (cnt[e.layer][e.type] || 0) + 1; });
      return <div className="card">
        <div className="card-head">
          <select value={cur} onChange={e => setV(e.target.value)} style={{ width: 'auto', minWidth: 220 }} aria-label="Fayl">{opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}</select>
          <button className="primary sm" onClick={() => checkedDownload(fname, txt, extra, openOk)}><Icon name="download" size={14} /> {fname}</button>
        </div>
        <div className="row tight small" style={{ margin: '4px 0 8px' }}>
          <span className="tag">{parsed.ver}</span><span className="tag">mm (INSUNITS={parsed.insunits})</span>
          {Object.entries(cnt).map(([l, t]) => <span key={l} className="tag">{l}: {Object.entries(t).map(([a, n]) => `${a} ${n}`).join(', ')}</span>)}
        </div>
        {val.ok ? <div className="msg ok">Qayta oʻqildi: konturlar yopiq, ustma-ust chiziq yoʻq, birlik mm.</div> : val.issues.map((i: any, k: number) => <div key={k} className="msg err">✕ {i.msg}</div>)}
        <Svg html={dxfSVG(parsed)} />
        <details><summary className="small">DXF matni (dastlabki 300 qator)</summary><pre className="calc" style={{ maxHeight: 300, overflow: 'auto' }}>{txt.split('\n').slice(0, 300).join('\n')}</pre></details>
      </div>;
    })()}
  </div>;
}

/* ---------------- Sozlamalar ---------------- */
export function SettingsView({ P, upd }: any) {
  const num = (k: string, label: string, step = 'any') => <label className="f">{label}<input type="number" min={0} step={step} value={P[k]} onChange={e => { const v = e.target.value; if (v === '' || !(+v >= 0)) return; upd((p: any) => { p[k] = +v; }, 'set-' + k); }} /></label>;
  const ck = (k: string, label: string) => <label className="ck"><input type="checkbox" checked={!!P[k]} onChange={e => upd((p: any) => { p[k] = e.target.checked; })} />{label}</label>;
  const sel = (k: string, label: string, o: [string, string][]) => <label className="f">{label}<select value={P[k]} onChange={e => upd((p: any) => { p[k] = e.target.value; })}>{o.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>;
  const tests = useMemo(() => C.selfTest(), []);
  return <div className="page narrow">
    <PageHead title="Sozlamalar" sub="Buyurtma boʻyicha material, rulon va DXF parametrlari. Oʻzgarishlar avtomatik saqlanadi." />
    <div className="card">
      <h3>Material</h3>
      <div className="fields">
        <div className="wide">{sel('mat', 'Material', Object.entries(C.MATERIALS as Record<string, { name: string }>).map(([k, m]) => [k, m.name]))}</div>
        {num('T', 'Qalinlik T, mm', '0.05')}
        {sel('calc', 'Yoyilma hisobi', [['sum', 'Oddiy yigʻindi'], ['k', 'K-faktor']])}
        {P.calc === 'k' && <>{num('R', 'Ichki radius R, mm', '0.1')}{num('K', 'K-faktor', '0.01')}</>}
      </div>
      <p className="note">Oddiy yigʻindi — tunuka uchun sexdagi standart: yoyilma = segmentlar yigʻindisi.</p>
    </div>
    <div className="card">
      <h3>Rulon / list</h3>
      <div className="fields">
        {num('sheetW', 'List eni, mm', '1')}{num('maxLen', 'Maks. uzunlik, mm', '1')}
        {num('margin', 'Chekkadan, mm', '0.5')}{!P.commonLine && num('gap', 'Detallar orasi, mm', '0.5')}
        {ck('commonLine', 'Umumiy chiziq bilan kesish (polosalar orasi 0)')}
        {ck('rotate', 'Detalni 90° burishga ruxsat')}
      </div>
    </div>
    <div className="card">
      <h3>DXF (CypCut)</h3>
      <div className="fields">
        {sel('dxfVer', 'Versiya', [['AC1015', 'AutoCAD 2000'], ['AC1009', 'AutoCAD R12']])}{num('prec', 'Aniqlik (kasr)', '1')}
        {ck('rectAsLines', 'Konturni LINE larga boʻlib yozish')}
        {ck('bendLayer', 'BEND qatlami: bukish chiziqlari')}
        {ck('labelLayer', 'LABEL qatlami: detal raqami')}
        {ck('sheetLayer', 'SHEET qatlami: list chegarasi')}
        {num('speed', 'Kesish tezligi, m/min', '1')}{num('pierce', 'Teshish, s', '0.05')}
      </div>
      <p className="note">Standart DXF da faqat CUT qatlami. BEND/LABEL/SHEET yoqilsa, CypCut&apos;da ularni «kesmaslik» yoki «Mark» qilib qoʻying.</p>
    </div>
    <div className="card">
      <h3>Dastur ichidagi testlar</h3>
      <ul className="checks">{tests.map((t: any, i: number) => <li key={i} className={t.pass ? 'ok' : 'err'} title={t.detail}><Icon name={t.pass ? 'check' : 'warn'} size={14} /> {t.name}</li>)}</ul>
    </div>
  </div>;
}

const PageHead = ({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) => (
  <div className="page-head"><div><h2>{title}</h2>{sub && <p className="muted">{sub}</p>}</div>{right}</div>
);
const Stat = ({ l, v }: { l: string; v: React.ReactNode }) => <div className="stat"><span>{l}</span><b>{v}</b></div>;
const Empty = ({ text }: { text: string }) => <div className="empty">{text}</div>;
