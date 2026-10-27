'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import Core from '@/lib/core';
import { api, logout } from '@/lib/api';
import { TPL, SIDE_EDITORS, mkItem, sanitize, regen, partName, partDXF, checkedDownload, zipAll } from '@/lib/model';
import { Pt, Seg, chainGeom, toNum } from '@/lib/sketch';
import Sketch, { Ghost, SketchOpts, LEN_STEPS } from './Sketch';
import Inspector from './Inspector';
import { FlatView, NestView, ExportView, SettingsView } from './Views';
import { Icon, IconName } from './Icons';
import { HelpModal, Spinner, useConfirm, useToast } from './ui';
const C: any = Core;
const fmt = C.fmt;

const Viewer3D = dynamic(() => import('./Viewer3D'), { ssr: false, loading: () => <div className="v3" /> });
type Tab = 'draw' | 'flat' | 'nest' | 'export' | 'settings';
const TABS: [Tab, string, IconName][] = [['draw', 'Chizma', 'pencil'], ['flat', 'Yoyilma', 'flat'], ['nest', 'Raskroy', 'layers'], ['export', 'Eksport', 'download'], ['settings', 'Sozlama', 'settings']];
const OPTS_KEY = 'tl_sketch_opts';
const DEF_OPTS: SketchOpts = { angStep: 15, lenStep: 1, grid: true, dims: true, angles: true, overall: true, track: true };
const defLen = (u: string) => (u === 'sm' ? 0.1 : 1);

/** Tanlangan detal → chizma konteksti (qaysi zanjir tahrirlanadi, atrofida nima koʻrinadi) */
function sketchCtx(it: any, P: any, key: string) {
  const f = P.unit === 'sm' ? 10 : 1, hv = Math.max(2, (+P.T || 0.5) * 4) / f;
  if (it.type !== 'tray') return { segs: (it.segs || []) as Seg[], d0: null, origin: [0, 0] as Pt, mirror: false, ghosts: [] as Ghost[], hv, canPrepend: true, key: 'segs', base: null as null | { field: string; B: number } };
  const S = C.sidesFor(it), W = key === 'R' || key === 'L', right = key === 'R' || key === 'T';
  const field = W ? 'base' : 'baseL', B = Math.max(toNum(it[field]) || 0, 0);
  const other: Seg[] = W ? (right ? S.L : S.R) : (right ? S.B : S.T);
  const oo: Pt = [right ? -B / 2 : B / 2, 0], om = right ? -1 : 1;
  const og = chainGeom(other, 0, hv), gpts: Pt[] = [oo, ...og.segs.flatMap(g => g.pts.map(q => [oo[0] + om * q[0], q[1]] as Pt))];
  const ghosts: Ghost[] = [{ kind: 'base', pts: [[-B / 2, 0], [B / 2, 0]] }];
  if (other.length) ghosts.push({ kind: 'ghost', pts: gpts });
  return { segs: (it.sides?.[key] || []) as Seg[], d0: 0, origin: [right ? B / 2 : -B / 2, 0] as Pt, mirror: !right, ghosts, hv, canPrepend: false, key, base: { field, B } };
}

export default function Editor({ id }: { id: string }) {
  const [P, setP] = useState<any>(null);
  const Pref = useRef<any>(null);
  const hist = useRef({ past: [] as any[], future: [] as any[], tag: '', t: 0 });
  const [name, setName] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [editKey, setEditKey] = useState('R');
  const [selSeg, setSelSeg] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>('draw');
  const [view3d, setView3d] = useState(false);
  const [status, setStatus] = useState<'' | 'saving' | 'saved' | 'error'>('');
  const [statusMsg, setStatusMsg] = useState('');
  const [err, setErr] = useState('');
  const [addOpen, setAddOpen] = useState<null | { left: number; top: number; maxH: number }>(null);
  const [opts, setOptsState] = useState<SketchOpts>(DEF_OPTS);
  const [partsOpen, setPartsOpen] = useState(false);
  const [showProps, setShowProps] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [zipping, setZipping] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();
  const dirty = useRef(false);

  /* ---------- yuklash ---------- */
  useEffect(() => {
    let saved: Partial<SketchOpts> | null = null;
    try { saved = JSON.parse(localStorage.getItem(OPTS_KEY) || 'null'); } catch { /* */ }
    api(`/projects/${id}`).then(r => {
      const p = sanitize(r.data); Pref.current = p; setOptsState({ ...DEF_OPTS, lenStep: defLen(p.unit), ...(saved || {}) }); setP(p); setName(r.name);
      const first = p.items[0]; setSel(first?.id ?? null); if (first?.type === 'tray') setEditKey(SIDE_EDITORS[first.sideMode][0][0]);
    }).catch(e => setErr(e.message));
  }, [id]);
  const setOpts = (o: SketchOpts) => { setOptsState(o); try { localStorage.setItem(OPTS_KEY, JSON.stringify(o)); } catch { /* */ } };
  // birlik almashsa (yoki birinchi yuklashda saqlangan qadam mos kelmasa) uzunlik qadamini moslash
  const prevUnit = useRef<string | null>(null);
  useEffect(() => {
    if (!P) return;
    const changed = prevUnit.current !== null && prevUnit.current !== P.unit;
    prevUnit.current = P.unit;
    if (changed || !(LEN_STEPS[P.unit] || []).includes(opts.lenStep)) setOptsState(o => ({ ...o, lenStep: defLen(P.unit) }));
  }, [P?.unit]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- oʻzgartirish + tarix (Ctrl+Z / Ctrl+Y) ---------- */
  const commit = useCallback((fn: (p: any) => void, tag = '') => {
    const prev = Pref.current; if (!prev) return;
    const next = structuredClone(prev); fn(next);
    const h = hist.current, now = Date.now();
    if (!(tag && tag === h.tag && now - h.t < 1200)) { h.past.push(prev); if (h.past.length > 300) h.past.shift(); }
    h.tag = tag; h.t = now; h.future = [];
    Pref.current = next; dirty.current = true; setP(next);
  }, []);
  const undo = useCallback(() => { const h = hist.current; if (!h.past.length) return; h.future.push(Pref.current); const n = h.past.pop(); h.tag = ''; Pref.current = n; dirty.current = true; setP(n); }, []);
  const redo = useCallback(() => { const h = hist.current; if (!h.future.length) return; h.past.push(Pref.current); const n = h.future.pop(); h.tag = ''; Pref.current = n; dirty.current = true; setP(n); }, []);

  /* ---------- saqlash ---------- */
  const save = useCallback(async () => {
    if (!Pref.current) return;
    setStatus('saving');
    try { await api(`/projects/${id}`, { method: 'PUT', body: { name, data: Pref.current } }); setStatus('saved'); setStatusMsg(''); }
    catch (e) { setStatus('error'); setStatusMsg((e as Error).message); }
  }, [id, name]);
  useEffect(() => {
    if (!P || !dirty.current) return;
    setStatus('saving');
    const t = setTimeout(save, 700);
    return () => clearTimeout(t);
  }, [P, name, save]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (status === 'saving') e.preventDefault(); };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [status]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 's') { e.preventDefault(); save(); return; }
      if ((e.target as HTMLElement).closest?.('input,textarea')) return;
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); } else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [undo, redo, save]);

  const R = useMemo(() => (P ? regen(P) : null), [P]);
  const it = P?.items.find((i: any) => i.id === sel);
  const key = it?.type === 'tray' ? ((SIDE_EDITORS[it.sideMode] as [string, string][]).some(([k]) => k === editKey) ? editKey : SIDE_EDITORS[it.sideMode][0][0]) : 'segs';
  const ctx = useMemo(() => (it && P ? sketchCtx(it, P, key) : null), [it, P, key]);

  const selectItem = (iid: string | null) => {
    setSel(iid); setSelSeg(null);
    const x = P?.items.find((i: any) => i.id === iid);
    if (x?.type === 'tray') setEditKey(SIDE_EDITORS[x.sideMode][0][0]);
  };
  const updItem = (fn: (x: any) => void, tag = '') => commit(p => { const x = p.items.find((i: any) => i.id === sel); if (x) fn(x); }, tag ? tag + sel : '');
  const setSegs = (s: Seg[], tag = '') => updItem(x => { if (x.type === 'tray') x.sides[key] = s; else x.segs = s; }, tag ? 'seg-' + key + tag : '');
  const addItem = (k: string) => {
    let nid = '';
    commit(p => { const n = mkItem(k, p); nid = n.id; p.items.push(n); });
    setAddOpen(null); setTab('draw'); setTimeout(() => selectItem(nid));
  };
  const dupItem = (x: any) => { let nid = ''; commit(p => { const c = structuredClone(x); c.id = 'P' + (p.nextId++); c.name += ' (nusxa)'; nid = c.id; p.items.push(c); }); setTimeout(() => selectItem(nid)); };
  const doZip = async () => {
    if (zipping) return;
    setZipping(true);
    try { toast(await zipAll(P, name, R), 'ok'); } catch (e) { toast((e as Error).message, 'err'); } finally { setZipping(false); }
  };
  const delItem = async (x: any) => {
    if (!(await confirm({ title: 'Detalni oʻchirish', text: `«${x.name}» oʻchiriladi. Ctrl+Z bilan qaytarish mumkin.`, ok: 'Oʻchirish' }))) return;
    const rest = P.items.filter((i: any) => i.id !== x.id);
    commit(p => { p.items = p.items.filter((i: any) => i.id !== x.id); });
    if (sel === x.id) selectItem(rest[0]?.id ?? null);
  };

  if (err) return <div style={{ maxWidth: 420, margin: '14vh auto', padding: '0 16px', textAlign: 'center' }}><div className="msg err" style={{ justifyContent: 'center' }}><Icon name="warn" size={16} />{err}</div><Link href="/"><button className="primary" style={{ marginTop: 12 }}><Icon name="back" size={16} />Buyurtmalarga qaytish</button></Link></div>;
  if (!P || !R) return <div style={{ display: 'grid', placeItems: 'center', height: '100vh', gap: 10, color: 'var(--muted)', alignContent: 'center' }}><Spinner />Yuklanmoqda…</div>;

  const pt = it && R.PART.get(it.id), U = P.unit === 'sm' ? 'sm' : 'mm';
  const h = hist.current;
  const editorName = it?.type === 'tray' ? (SIDE_EDITORS[it.sideMode] as [string, string][]).find(([k]) => k === key)?.[1] : null;

  return (
    <div className={`app tab-${tab}`}>
      <header className="topbar">
        <Link href="/" title="Buyurtmalar roʻyxatiga qaytish"><button className="ghost back" tabIndex={-1}><Icon name="back" size={18} /><span className="back-t">Buyurtmalar</span></button></Link>
        <span className="vdiv hide-sm" />
        <input className="pname" value={name} onChange={e => { dirty.current = true; setName(e.target.value); }} aria-label="Buyurtma nomi" />
        <span className={`save ${status}`} title={statusMsg}>
          {status === 'saving' ? <><Spinner /><span className="save-t">Saqlanmoqda…</span></> : status === 'saved' ? <><Icon name="check" size={15} /><span className="save-t">Saqlandi</span></> : status === 'error' ? <><Icon name="warn" size={15} /><span className="save-t">Saqlanmadi</span></> : null}
        </span>
        <span className="spacer" />
        <button className="icon-btn" onClick={undo} disabled={!h.past.length} title="Bekor qilish (Ctrl+Z)" aria-label="Bekor qilish"><Icon name="undo" size={18} /></button>
        <button className="icon-btn" onClick={redo} disabled={!h.future.length} title="Qaytarish (Ctrl+Y)" aria-label="Qaytarish"><Icon name="redo" size={18} /></button>
        <span className="vdiv hide-sm" />
        <button className="primary sm" onClick={doZip} disabled={zipping} title="Barcha listlar va detallar DXF (ZIP)">{zipping ? <Spinner /> : <Icon name="download" size={15} />}<span className="hide-sm">DXF ZIP</span></button>
        <button className="icon-btn" onClick={() => setHelpOpen(true)} title="Yordam va qisqa tugmalar" aria-label="Yordam"><Icon name="help" size={19} /></button>
        <button className="icon-btn hide-sm" onClick={logout} title="Chiqish" aria-label="Chiqish"><Icon name="logout" size={18} /></button>
      </header>

      <nav className="rail" aria-label="Boʻlimlar">
        {TABS.map(([k, l, ic]) => <button key={k} className={`rail-i${tab === k ? ' on' : ''}`} aria-current={tab === k ? 'page' : undefined} onClick={() => { setTab(k); setShowProps(false); setPartsOpen(false); }}><Icon name={ic} size={21} />{l}{k === 'nest' && R.NEST && R.NEST.sheets.length > 0 ? <span className="badge">{R.NEST.sheets.length}</span> : null}</button>)}
        <span className="rail-sep" />
        <button className="rail-i only-sm" onClick={() => setPartsOpen(o => !o)} aria-expanded={partsOpen}><Icon name="parts" size={21} />Detallar</button>
        {tab === 'draw' && <button className={`rail-i only-sm${showProps ? ' on' : ''}`} onClick={() => setShowProps(s => !s)}><Icon name="settings" size={21} />Xossa</button>}
      </nav>

      <div className={`work${showProps ? ' show-props' : ''}${tab === 'draw' || tab === 'flat' ? '' : ' no-parts'}${tab === 'draw' && !(it && ctx) ? ' no-props' : ''}`}>
        {/* ---------- chap: detallar ---------- */}
        {(tab === 'draw' || tab === 'flat') && <aside className={`parts${partsOpen ? ' open' : ''}`}>
          <div className="parts-head">
            <h3>Detallar <span className="count">{P.items.length}</span></h3>
            <div className="add">
              <button className="primary sm" onClick={e => { if (addOpen) { setAddOpen(null); return; } const b = e.currentTarget.getBoundingClientRect(); setAddOpen({ left: b.left, top: b.bottom + 6, maxH: window.innerHeight - b.bottom - 18 }); }} aria-expanded={!!addOpen}><Icon name="plus" size={14} /> Qoʻshish</button>
              {addOpen && <>
                <div className="backdrop" onClick={() => setAddOpen(null)} />
                <div className="menu" role="menu" style={{ left: addOpen.left, top: addOpen.top, maxHeight: addOpen.maxH }}>
                  <div className="menu-h">Chizish</div>
                  <button role="menuitem" onClick={() => addItem('chiz')}><b>Yangi kesim</b><span>Boʻsh — sichqoncha bilan chizasiz</span></button>
                  <div className="menu-h">Profil shablonlari</div>
                  {Object.entries(TPL).filter(([, t]: [string, any]) => t.type === 'profile' && !t.blank).map(([k, t]: [string, any]) => <button role="menuitem" key={k} onClick={() => addItem(k)}><b>{t.name}</b></button>)}
                  <div className="menu-h">Taglikli detallar</div>
                  {Object.entries(TPL).filter(([, t]: [string, any]) => t.type === 'tray').map(([k, t]: [string, any]) => <button role="menuitem" key={k} onClick={() => addItem(k)}><b>{t.name}</b><span>{C.SIDE_MODES[t.sideMode]}</span></button>)}
                </div>
              </>}
            </div>
          </div>
          {!P.items.length && <div className="parts-empty">Hali detal yoʻq.<br />Birinchi detalni qoʻshing va chizishni boshlang.<br /><button className="primary sm" onClick={() => addItem('chiz')}><Icon name="plus" size={14} /> Yangi kesim</button></div>}
          <ul className="plist">
            {P.items.map((i: any) => {
              const q = R.PART.get(i.id), e = R.ERR.get(i.id);
              return <li key={i.id} className={i.id === sel ? 'on' : ''} onClick={() => { selectItem(i.id); setPartsOpen(false); if (tab !== 'draw' && tab !== 'flat') setTab('draw'); }}>
                <div className="pl-main">
                  <span className="pl-id">{i.id}</span>
                  <span className="pl-name">{i.name}</span>
                  <span className="pl-qty">×{i.qty}</span>
                </div>
                <div className="pl-sub">
                  {e ? <span className="err-t"><Icon name="warn" size={12} /> {e}</span> : <span>{i.type === 'tray' ? C.SIDE_MODES[i.sideMode] : 'erkin kesim'} · {q ? `${fmt(q.Y, 1)} × ${fmt(q.X, 0)}` : '—'}</span>}
                </div>
                <div className="pl-act">
                  <button className="icon-btn sm" title="Nusxa" aria-label="Nusxa" onClick={ev => { ev.stopPropagation(); dupItem(i); }}><Icon name="copy" size={14} /></button>
                  <button className="icon-btn sm danger" title="Oʻchirish" aria-label="Oʻchirish" onClick={ev => { ev.stopPropagation(); delItem(i); }}><Icon name="trash" size={14} /></button>
                </div>
              </li>;
            })}
          </ul>
        </aside>}

        {/* ---------- markaz ---------- */}
        <main className="center-pane">
          {tab === 'draw' && (!it || !ctx ? <div className="empty big">Chapdan detal tanlang yoki yangisini qoʻshing.<br /><button className="primary" style={{ marginTop: 14 }} onClick={() => addItem('chiz')}><Icon name="plus" size={16} />Yangi kesim chizish</button></div> : <div className="drawpane">
            <div className="dp-head">
              <div className="dp-title">
                <b>{it.name}</b>
                {editorName && <span className="tag">{editorName}</span>}
                {it.type === 'tray' && <span className="muted small">→ tashqariga · ↑ yuqoriga (taglikdan)</span>}
              </div>
              <div className="dp-result">{pt ? <>Yoyilma <b>{fmt(pt.Y, 2)} × {fmt(pt.X, 2)}</b> mm</> : <span className="err-t"><Icon name="warn" size={13} /> {R.ERR.get(it.id)}</span>}</div>
              <div className="row tight">
                <div className="seg-ctl small-ctl"><button className={!view3d ? 'on' : ''} onClick={() => setView3d(false)}>2D</button><button className={view3d ? 'on' : ''} onClick={() => setView3d(true)} disabled={!pt}>3D</button></div>
                <button className="sm" disabled={!pt} onClick={() => checkedDownload(partName(name, it, pt), partDXF(P, it, pt))}><Icon name="download" size={14} /> DXF</button>
              </div>
            </div>
            {view3d && pt ? <div className="v3wrap"><Viewer3D pt={pt} it={it} P={P} /><div className="v3hint">chap tugma — aylantirish · oʻng / Shift — surish · gʻildirak — masshtab</div></div> :
              <Sketch
                segs={ctx.segs} d0={ctx.d0} origin={ctx.origin} mirror={ctx.mirror} ghosts={ctx.ghosts} hv={ctx.hv} canPrepend={ctx.canPrepend}
                baseDim={ctx.base ? { a: [-ctx.base.B / 2, 0], b: [ctx.base.B / 2, 0], value: ctx.base.B, onEdit: v => updItem(x => { x[ctx.base!.field] = v; }) } : undefined}
                unit={U} viewKey={`${it.id}:${key}:${U}`}
                sel={selSeg} onSel={setSelSeg}
                onChange={(s, tag) => setSegs(s, tag)}
                opts={opts} setOpts={setOpts}
                onUndo={undo} onRedo={redo} canUndo={h.past.length > 0} canRedo={h.future.length > 0}
              />}
          </div>)}
          {tab === 'flat' && <FlatView P={P} R={R} onOpen={(iid: string) => { selectItem(iid); setTab('draw'); }} />}
          {tab === 'nest' && <NestView P={P} R={R} name={name} />}
          {tab === 'export' && <ExportView P={P} R={R} name={name} onZip={doZip} />}
          {tab === 'settings' && <SettingsView P={P} upd={commit} />}
        </main>

        {/* ---------- oʻng: xususiyatlar (faqat chizmada) ---------- */}
        {tab === 'draw' && it && ctx && <aside className="props">
          <Inspector P={P} it={it} pt={pt} err={R.ERR.get(it.id)} U={U} upd={commit} updItem={updItem}
            editKey={key} setEditKey={k => { setEditKey(k); setSelSeg(null); }}
            segs={ctx.segs} setSegs={setSegs} d0={ctx.d0} mirror={ctx.mirror} hv={ctx.hv}
            sel={selSeg} setSel={setSelSeg} />
        </aside>}
      </div>
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
    </div>
  );
}
