/** API so'rovlari (Next.js /api -> NestJS proksi). Token localStorage da saqlanadi. */
export const TOKEN_KEY = 'tl_token';

export async function api<T = any>(path: string, opt: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
  const r = await fetch('/api' + path, {
    method: opt.method ?? 'GET',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: opt.body !== undefined ? JSON.stringify(opt.body) : undefined,
  });
  const j = await r.json().catch(() => null);
  if (r.status === 401 && !path.startsWith('/auth/')) {
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = '/login';
  }
  if (!r.ok) {
    const m = j?.message;
    throw new Error(Array.isArray(m) ? m.join(', ') : m || (r.status >= 500 ? 'Server bilan aloqa yoʻq (API ishga tushganmi?)' : `Xato ${r.status}`));
  }
  return j as T;
}

export const loggedIn = () => typeof window !== 'undefined' && !!localStorage.getItem(TOKEN_KEY);
export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  window.location.href = '/login';
}
