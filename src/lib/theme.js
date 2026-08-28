import { create } from 'zustand';

export const C = {
  ink: '#0B2B26',
  inkSoft: '#12433C',
  teal: '#146C5E',
  tealLight: '#1E8C77',
  paper: '#F6F3EC',
  paperDark: '#0A1F1C',
  card: '#FFFFFF',
  cardDark: '#0F2E29',
  amber: '#C77B2C',
  clay: '#B84C3D',
  sage: '#6E9C82',
};

export const useUIStore = create((set) => ({
  dark: typeof window !== 'undefined' && localStorage.getItem('smm-theme') === 'dark',
  toggleDark: () => set((s) => {
    const next = !s.dark;
    localStorage.setItem('smm-theme', next ? 'dark' : 'light');
    return { dark: next };
  }),
  paletteOpen: false,
  setPaletteOpen: (v) => set({ paletteOpen: v }),
}));

let toastId = 0;
export const useToastStore = create((set) => ({
  toasts: [],
  push: (message, type = 'info') => set((s) => {
    const id = ++toastId;
    setTimeout(() => {
      set((s2) => ({ toasts: s2.toasts.filter((t) => t.id !== id) }));
    }, 4200);
    return { toasts: [...s.toasts, { id, message, type }] };
  }),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
