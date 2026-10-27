'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Icon } from './Icons';

/* ===================== Toast ===================== */
type ToastKind = 'ok' | 'err' | 'info';
type Toast = { id: number; kind: ToastKind; text: string };
const ToastCtx = createContext<(text: string, kind?: ToastKind) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

/* ===================== Confirm ===================== */
type ConfirmOpts = { title: string; text?: string; ok?: string; danger?: boolean };
const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<boolean>>(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);

export function Providers({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nid = useRef(1);
  const toast = useCallback((text: string, kind: ToastKind = 'info') => {
    const id = nid.current++;
    setToasts(t => [...t.slice(-3), { id, kind, text }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4200);
  }, []);

  const [cf, setCf] = useState<null | (ConfirmOpts & { resolve: (v: boolean) => void })>(null);
  const confirm = useCallback((o: ConfirmOpts) => new Promise<boolean>(resolve => setCf({ ...o, resolve })), []);
  const close = (v: boolean) => { cf?.resolve(v); setCf(null); };

  return (
    <ToastCtx.Provider value={toast}>
      <ConfirmCtx.Provider value={confirm}>
        {children}
        {cf && (
          <Modal title={cf.title} onClose={() => close(false)} small
            footer={<>
              <button onClick={() => close(false)}>Bekor qilish</button>
              <button className={cf.danger === false ? 'primary' : 'primary danger-solid'} autoFocus onClick={() => close(true)}>{cf.ok || 'Ha'}</button>
            </>}>
            {cf.text && <p className="muted" style={{ margin: 0 }}>{cf.text}</p>}
          </Modal>
        )}
        <div className="toasts" role="status" aria-live="polite">
          {toasts.map(t => (
            <div key={t.id} className={`toast-i ${t.kind}`}>
              <Icon name={t.kind === 'err' ? 'warn' : t.kind === 'ok' ? 'check' : 'help'} size={16} />
              <span>{t.text}</span>
              <button className="icon-btn sm" aria-label="Yopish" onClick={() => setToasts(x => x.filter(y => y.id !== t.id))}><Icon name="close" size={14} /></button>
            </div>
          ))}
        </div>
      </ConfirmCtx.Provider>
    </ToastCtx.Provider>
  );
}

/* ===================== Modal ===================== */
export function Modal({ title, onClose, children, footer, small, wide }: { title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; small?: boolean; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [onClose]);
  return (
    <div className="modal-bd" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal${small ? ' sm' : ''}${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-h"><h2>{title}</h2><button className="icon-btn" aria-label="Yopish" onClick={onClose}><Icon name="close" size={18} /></button></div>
        <div className="modal-b">{children}</div>
        {footer && <div className="modal-f">{footer}</div>}
      </div>
    </div>
  );
}

export const Spinner = () => <span className="spin" aria-hidden />;

/* ===================== Yordam (qisqa tugmalar) ===================== */
const KEYS: [string, string][] = [
  ['V', 'Tanlash asbobi'], ['L', 'Chiziq chizish'], ['A', 'Yoy'], ['H', 'Surish'], ['F', 'Hammasini koʻrsatish'], ['G', 'Toʻrni yoqish / oʻchirish'],
  ['Ctrl + Z', 'Bekor qilish'], ['Ctrl + Y', 'Qaytarish'], ['Ctrl + S', 'Darhol saqlash'],
  ['Shift', 'Chizishda erkin burchak'], ['← ↑ → ↓', 'Yoʻnalishni qotirish'], ['Enter', 'Yozilgan uzunlikni qoʻllash (25 yoki 25<45)'],
  ['Backspace', 'Oxirgi segmentni oʻchirish'], ['Esc', 'Bekor qilish / yopish'],
];
export function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Qanday ishlaydi" onClose={onClose} wide footer={<button className="primary" onClick={onClose}>Tushunarli</button>}>
      <ol className="steps">
        <li><b>Chizma</b><span>Detal qoʻshing va kesimini sichqoncha yoki raqamlar bilan chizing.</span></li>
        <li><b>Yoyilma</b><span>Har bir detalning yassi holati va bukish chiziqlarini tekshiring.</span></li>
        <li><b>Raskroy</b><span>Detallar rulon listiga avtomatik joylashadi.</span></li>
        <li><b>Eksport</b><span>Tekshirilgan DXF fayllarni CypCut uchun yuklab oling.</span></li>
      </ol>
      <h3 style={{ marginTop: 18 }}>Qisqa tugmalar</h3>
      <div className="keys">
        {KEYS.map(([k, d]) => <div key={k}><kbd>{k}</kbd><span>{d}</span></div>)}
      </div>
    </Modal>
  );
}
