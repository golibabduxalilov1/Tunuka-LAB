'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, loggedIn, logout } from '@/lib/api';
import { Icon } from './Icons';
import { HelpModal } from './ui';

/** Kirgan foydalanuvchi uchun umumiy karkas: yon panel + yuqori satr. Kirmagan boʻlsa /login ga yoʻnaltiradi. */
export default function AppShell({ title, count, actions, children }: { title: string; count?: number; actions?: React.ReactNode; children: React.ReactNode }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [open, setOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!loggedIn()) { router.replace('/login'); return; }
    setReady(true);
    api<{ email: string }>('/auth/me').then(u => setEmail(u.email)).catch(() => {});
  }, [router]);

  if (!ready) return null;
  return (
    <div className="shell">
      {open && <div className="side-scrim" onClick={() => setOpen(false)} />}
      <aside className={`side${open ? ' open' : ''}`}>
        <Link href="/" className="brand"><span className="logo">T</span>TunukaLab</Link>
        <span className="nav-sec">Ish joyi</span>
        <Link href="/" className="nav-i on" onClick={() => setOpen(false)}><Icon name="folder" size={18} />Buyurtmalar{count !== undefined && <span className="count">{count}</span>}</Link>
        <span className="nav-sec">Yordam</span>
        <button className="nav-i" onClick={() => { setHelp(true); setOpen(false); }}><Icon name="help" size={18} />Qanday ishlaydi</button>
        <button className="nav-i" onClick={() => { setHelp(true); setOpen(false); }}><Icon name="keyboard" size={18} />Qisqa tugmalar</button>
        <span className="grow" />
        <div className="me">
          <span className="avatar">{(email[0] || 'T')}</span>
          <div className="me-t"><b title={email}>{email || '…'}</b><span>Hisob</span></div>
          <button className="icon-btn" onClick={logout} title="Chiqish" aria-label="Chiqish"><Icon name="logout" size={18} /></button>
        </div>
      </aside>

      <div className="main">
        <header className="topb">
          <button className="icon-btn burger" onClick={() => setOpen(true)} aria-label="Menyu"><Icon name="menu" size={20} /></button>
          <h1>{title}</h1>
          <span className="spacer" />
          {actions}
        </header>
        <div className="content">{children}</div>
      </div>
      {help && <HelpModal onClose={() => setHelp(false)} />}
    </div>
  );
}
