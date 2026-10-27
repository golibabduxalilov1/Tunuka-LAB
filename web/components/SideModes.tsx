'use client';
/* Taglikli detal tomonlari rejimini rasm bilan tanlash. Bir xil rangdagi tomonlar bir xil profilga ega. */
const COL = { A: '#2563eb', B: '#ea580c', C: '#0d9488', D: '#7c3aed' } as const;
type K = keyof typeof COL;

/** rejim → [oʻng, chap, yuqori, past] rang (null — bukilmaydi) */
const LAYOUT: Record<string, [K | null, K | null, K | null, K | null]> = {
  '2s': ['A', 'A', null, null],
  '2d': ['A', 'B', null, null],
  '4s': ['A', 'A', 'A', 'A'],
  '4p': ['A', 'A', 'B', 'B'],
  '4d': ['A', 'B', 'C', 'D'],
};
export const MODE_INFO: Record<string, { title: string; hint: string }> = {
  '2s': { title: '2 tomon bir xil', hint: 'Uzun detal, ikki chekkasi bir xil bukilgan (GAP, planka)' },
  '2d': { title: '2 tomon har xil', hint: 'Ikki chekka turlicha bukilgan' },
  '4s': { title: '4 tomon bir xil', hint: 'Kasseta: toʻrtala tomon bir xil' },
  '4p': { title: '4 tomon juft', hint: 'Qarama-qarshi tomonlar bir xil (lotok)' },
  '4d': { title: '4 tomon har xil', hint: 'Har bir tomon alohida chiziladi' },
};

export function ModeIcon({ mode }: { mode: string }) {
  const [r, l, t, b] = LAYOUT[mode] || LAYOUT['2s'];
  const bar = (x: number, y: number, w: number, h: number, c: K | null) =>
    c ? <rect x={x} y={y} width={w} height={h} rx={1.5} fill={COL[c]} /> : <rect x={x} y={y} width={w} height={h} rx={1.5} fill="none" stroke="#cbd5e1" strokeDasharray="2 2" />;
  return (
    <svg width="56" height="40" viewBox="0 0 56 40" aria-hidden>
      <rect x="14" y="11" width="28" height="18" rx="1.5" fill="#e2e8f0" />
      {bar(44, 11, 6, 18, r)}{bar(6, 11, 6, 18, l)}{bar(14, 3, 28, 6, t)}{bar(14, 31, 28, 6, b)}
    </svg>
  );
}

export default function SideModePicker({ value, onChange }: { value: string; onChange: (m: string) => void }) {
  return (
    <div className="modes" role="radiogroup" aria-label="Tomonlar rejimi">
      {Object.entries(MODE_INFO).map(([k, m]) => (
        <button key={k} type="button" role="radio" aria-checked={value === k} className={`mode${value === k ? ' on' : ''}`} onClick={() => onChange(k)} title={m.hint}>
          <ModeIcon mode={k} />
          <b>{m.title}</b>
        </button>
      ))}
    </div>
  );
}
