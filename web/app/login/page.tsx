'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, loggedIn, TOKEN_KEY } from '@/lib/api';
import { Icon } from '@/components/Icons';
import { Spinner } from '@/components/ui';

const STEPS: [string, string][] = [['Kesimni chizing', 'Sichqoncha yoki raqamlar bilan profilni chizish'], ['Yoyilma', 'Bukish chiziqlari bilan yassi holat avtomatik hisoblanadi'], ['Rulon listi', 'Detallar 1250 × 6000 listga joylashadi'], ['CypCut DXF', 'Tekshirilgan tayyor fayllarni yuklab oling']];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (loggedIn()) router.replace('/'); }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const r = await api<{ token: string }>('/auth/login', { method: 'POST', body: { email, password } });
      localStorage.setItem(TOKEN_KEY, r.token);
      router.replace('/');
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <section className="auth-brand">
        <span className="brand"><span className="logo">T</span>TunukaLab</span>
        <div>
          <h1>Tunuka kesimidan tayyor DXF gacha</h1>
          <p>Chizing, yoyilmani tekshiring, rulon listiga joylang va CypCut uchun fayl oling — hammasi bir joyda.</p>
        </div>
        <ol className="flow">{STEPS.map(([t, d], i) => <li key={t}><span className="n">{i + 1}</span><div><b>{t}</b><span>{d}</span></div></li>)}</ol>
      </section>

      <section className="auth-form">
        <div className="auth">
          <h2>Xush kelibsiz</h2>
          <p className="muted" style={{ margin: 0 }}>Davom etish uchun hisobingizga kiring.</p>
          <form className="stack" onSubmit={submit}>
            <label className="f">Email<input type="email" autoComplete="email" required autoFocus placeholder="siz@kompaniya.uz" value={email} onChange={e => setEmail(e.target.value)} /></label>
            <label className="f">Parol
              <span className="input-ic">
                <input type={show ? 'text' : 'password'} autoComplete="current-password" required placeholder="Parol" value={password} onChange={e => setPassword(e.target.value)} style={{ paddingLeft: 10, paddingRight: 40 }} />
                <button type="button" className="icon-btn sm" onClick={() => setShow(!show)} aria-label={show ? 'Parolni yashirish' : 'Parolni koʻrsatish'}><Icon name={show ? 'eyeOff' : 'eye'} size={17} /></button>
              </span>
            </label>
            {err && <div className="msg err" role="alert"><Icon name="warn" size={15} />{err}</div>}
            <button className="primary lg block" disabled={busy}>{busy && <Spinner />}Kirish</button>
          </form>
        </div>
      </section>
    </div>
  );
}
