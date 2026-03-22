import type { User } from './types';

interface AppState {
  user: User | null;
  selectedDate: string;
  loading: boolean;
}

const listeners: (() => void)[] = [];

export const state: AppState = {
  user: null,
  selectedDate: new Date().toISOString().slice(0, 10),
  loading: true,
};

export function setState(updates: Partial<AppState>) {
  Object.assign(state, updates);
  listeners.forEach((fn) => fn());
}

export function onStateChange(fn: () => void) {
  listeners.push(fn);
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  if (dateStr === todayStr) return 'Today';
  if (dateStr === yesterdayStr) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
