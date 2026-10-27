'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { newProject } from '@/lib/model';
import AppShell from '@/components/AppShell';
import { Icon } from '@/components/Icons';
import { Modal, Spinner, useConfirm, useToast } from '@/components/ui';

type Row = { id: number; name: string; updated_at: string };
type Sort = 'new' | 'old' | 'az';
const VIEW_KEY = 'tl_home_view';

const toDate = (s: string) => new Date(s.replace(' ', 'T') + 'Z');
function ago(s: string) {
  const d = Date.now() - toDate(s).getTime(), m = Math.round(d / 60000);
  if (m < 1) return 'hozirgina';
  if (m < 60) return `${m} daqiqa oldin`;
  if (m < 60 * 24) return `${Math.round(m / 60)} soat oldin`;
  if (m < 60 * 24 * 30) return `${Math.round(m / 60 / 24)} kun oldin`;
  return toDate(s).toLocaleDateString('uz');
}
const defName = () => `Buyurtma ${new Date().toLocaleDateString('uz')}`;

export default function Home() {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('new');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [menu, setMenu] = useState<number | null>(null);
  const [dlg, setDlg] = useState<null | { kind: 'new' } | { kind: 'rename'; row: Row }>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api<Row[]>('/projects').then(setRows).catch(e => { setRows([]); toast(e.message, 'err'); });
  useEffect(() => {
    try { const v = localStorage.getItem(VIEW_KEY); if (v === 'list' || v === 'grid') setView(v); } catch { /* */ }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const setViewP = (v: 'grid' | 'list') => { setView(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* */ } };

  const shown = useMemo(() => {
    const f = (rows || []).filter(r => r.name.toLowerCase().includes(q.trim().toLowerCase()));
    if (sort === 'az') f.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === 'old') f.sort((a, b) => toDate(a.updated_at).getTime() - toDate(b.updated_at).getTime());
    return f;
  }, [rows, q, sort]);

  const openNew = () => { setText(defName()); setDlg({ kind: 'new' }); };
  const openRename = (row: Row) => { setMenu(null); setText(row.name); setDlg({ kind: 'rename', row }); };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!dlg || busy) return;
    setBusy(true);
    try {
      if (dlg.kind === 'new') {
        const r = await api<{ id: number }>('/projects', { method: 'POST', body: { name: text.trim() || defName(), data: newProject() } });
        router.push(`/p/${r.id}`);
        return;
      }
      const cur = await api(`/projects/${dlg.row.id}`);
      await api(`/projects/${dlg.row.id}`, { method: 'PUT', body: { name: text.trim() || dlg.row.name, data: cur.data } });
      toast('Nomi oʻzgartirildi', 'ok'); setDlg(null); load();
    } catch (er) { toast((er as Error).message, 'err'); }
    finally { setBusy(false); }
  }

  async function duplicate(row: Row) {
    setMenu(null);
    try {
      const cur = await api(`/projects/${row.id}`);
      await api('/projects', { method: 'POST', body: { name: `${row.name} (nusxa)`, data: cur.data } });
      toast('Nusxa yaratildi', 'ok'); load();
    } catch (er) { toast((er as Error).message, 'err'); }
  }

  async function remove(row: Row) {
    setMenu(null);
    if (!(await confirm({ title: 'Buyurtmani oʻchirish', text: `«${row.name}» butunlay oʻchiriladi. Buni qaytarib boʻlmaydi.`, ok: 'Oʻchirish' }))) return;
    try { await api(`/projects/${row.id}`, { method: 'DELETE' }); toast('Oʻchirildi', 'ok'); load(); } catch (er) { toast((er as Error).message, 'err'); }
  }

  const MenuPop = ({ r }: { r: Row }) => <>
    <div className="scrim" onClick={() => setMenu(null)} />
    <div className="menu-pop" role="menu">
      <button role="menuitem" onClick={() => openRename(r)}><Icon name="edit" size={16} />Nomini oʻzgartirish</button>
      <button role="menuitem" onClick={() => duplicate(r)}><Icon name="copy" size={16} />Nusxa yaratish</button>
      <button role="menuitem" className="danger" onClick={() => remove(r)}><Icon name="trash" size={16} />Oʻchirish</button>
    </div>
  </>;

  const last = rows && rows.length ? [...rows].sort((a, b) => toDate(b.updated_at).getTime() - toDate(a.updated_at).getTime())[0] : null;

  return (
    <AppShell title="Buyurtmalar" count={rows?.length} actions={<button className="primary" onClick={openNew}><Icon name="plus" size={16} /><span className="hide-sm">Yangi buyurtma</span></button>}>
      <div className="hero">
        <div><h2>Salom! 👋</h2><p>Buyurtmani tanlang yoki yangisini boshlang: kesim → yoyilma → raskroy → DXF.</p></div>
        {last && <Link href={`/p/${last.id}`} className="nav-i" style={{ width: 'auto', border: '1px solid var(--line)', background: 'var(--panel)' }}><Icon name="clock" size={17} />Davom ettirish: <b>{last.name}</b></Link>}
      </div>

      <div className="kpis">
        <div className="kpi"><span className="ic"><Icon name="folder" size={20} /></span><div><span>Jami buyurtmalar</span><b>{rows ? rows.length : '—'}</b></div></div>
        <div className="kpi"><span className="ic"><Icon name="clock" size={20} /></span><div><span>Oxirgi oʻzgarish</span><b>{last ? ago(last.updated_at) : '—'}</b></div></div>
      </div>

      <div className="toolbar">
        <label className="input-ic search">
          <Icon name="search" size={16} />
          <input placeholder="Buyurtma qidirish…" value={q} onChange={e => setQ(e.target.value)} aria-label="Qidirish" />
          {q && <button className="icon-btn sm" aria-label="Tozalash" onClick={() => setQ('')}><Icon name="close" size={14} /></button>}
        </label>
        <select value={sort} onChange={e => setSort(e.target.value as Sort)} aria-label="Saralash">
          <option value="new">Avval yangilari</option><option value="old">Avval eskilari</option><option value="az">Nomi boʻyicha (A–Z)</option>
        </select>
        <span className="spacer" />
        <div className="seg2" role="group" aria-label="Koʻrinish">
          <button className={view === 'grid' ? 'on' : ''} onClick={() => setViewP('grid')} title="Kartochkalar" aria-label="Kartochkalar"><Icon name="grid" size={16} /></button>
          <button className={view === 'list' ? 'on' : ''} onClick={() => setViewP('list')} title="Roʻyxat" aria-label="Roʻyxat"><Icon name="list" size={16} /></button>
        </div>
      </div>

      {rows === null ? (
        <div className="cards">{[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 150 }} />)}</div>
      ) : rows.length === 0 ? (
        <div className="empty-big">
          <div className="pc-ic"><Icon name="folder" size={26} /></div>
          <h3>Hali buyurtma yoʻq</h3><p>Birinchi buyurtmangizni yarating va kesimni chizishni boshlang.</p>
          <button className="primary lg" onClick={openNew}><Icon name="plus" size={17} />Yangi buyurtma</button>
        </div>
      ) : shown.length === 0 ? (
        <div className="empty-big"><h3>Hech narsa topilmadi</h3><p>«{q}» boʻyicha buyurtma yoʻq.</p><button onClick={() => setQ('')}>Qidiruvni tozalash</button></div>
      ) : view === 'grid' ? (
        <div className="cards">
          {shown.map(r => (
            <div key={r.id} className="pc">
              <Link href={`/p/${r.id}`} className="pc-open">
                <span className="pc-ic"><Icon name="layers" size={20} /></span>
                <div><div className="pc-name" title={r.name}>{r.name}</div><div className="pc-meta"><Icon name="clock" size={13} />{ago(r.updated_at)}</div></div>
              </Link>
              <div className="pc-foot">
                <Link href={`/p/${r.id}`}><button className="sm primary">Ochish</button></Link>
                <span className="spacer" />
                <button className="icon-btn" aria-label="Amallar" aria-haspopup="menu" onClick={() => setMenu(menu === r.id ? null : r.id)}><Icon name="more" size={18} /></button>
              </div>
              {menu === r.id && <MenuPop r={r} />}
            </div>
          ))}
        </div>
      ) : (
        <div className="rows">
          {shown.map(r => (
            <div key={r.id} className="rw">
              <Link href={`/p/${r.id}`}><span className="pc-ic"><Icon name="layers" size={17} /></span><span className="pc-name" title={r.name}>{r.name}</span></Link>
              <span className="when hide-sm">{ago(r.updated_at)}</span>
              <button className="icon-btn" aria-label="Amallar" aria-haspopup="menu" onClick={() => setMenu(menu === r.id ? null : r.id)}><Icon name="more" size={18} /></button>
              {menu === r.id && <MenuPop r={r} />}
            </div>
          ))}
        </div>
      )}

      {dlg && (
        <Modal title={dlg.kind === 'new' ? 'Yangi buyurtma' : 'Nomini oʻzgartirish'} onClose={() => setDlg(null)} small
          footer={<>
            <button onClick={() => setDlg(null)}>Bekor qilish</button>
            <button className="primary" form="dlg-form" disabled={busy}>{busy && <Spinner />}{dlg.kind === 'new' ? 'Yaratish' : 'Saqlash'}</button>
          </>}>
          <form id="dlg-form" onSubmit={submit}>
            <label className="f">Buyurtma nomi<input autoFocus value={text} onChange={e => setText(e.target.value)} maxLength={120} onFocus={e => e.currentTarget.select()} /></label>
            {dlg.kind === 'new' && <p className="muted small" style={{ marginBottom: 0 }}>Yaratgandan soʻng muharrir ochiladi. Oʻzgarishlar avtomatik saqlanadi.</p>}
          </form>
        </Modal>
      )}
    </AppShell>
  );
}
