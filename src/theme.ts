export type ThemePref = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'mt_theme';

export function getTheme(): ThemePref {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch { /* ignore */ }
  return 'system';
}

function effectiveIsDark(pref: ThemePref): boolean {
  if (pref === 'dark') return true;
  if (pref === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyEffective(pref: ThemePref) {
  const dark = effectiveIsDark(pref);
  document.documentElement.classList.toggle('dark', dark);

  // Keep the browser's URL/status bar color in sync with the active theme.
  const meta = document.querySelector('meta[name="theme-color"]:not([media])') as HTMLMetaElement | null;
  const color = dark ? '#0F1419' : '#F8F9FF';
  if (meta) {
    meta.content = color;
  } else {
    const m = document.createElement('meta');
    m.name = 'theme-color';
    m.content = color;
    document.head.appendChild(m);
  }
}

export function setTheme(pref: ThemePref) {
  try {
    localStorage.setItem(STORAGE_KEY, pref);
  } catch { /* ignore */ }
  applyEffective(pref);
}

// Re-evaluate when OS theme changes, but only if user is on `system`.
export function initTheme() {
  applyEffective(getTheme());
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', () => {
    if (getTheme() === 'system') applyEffective('system');
  });
}
