/** Messages brefs affichés par-dessus n'importe quel écran (confirmation d'une action qui s'est terminée ailleurs). */
export type Toast = { id: number; message: string; tone: 'success' | 'info' | 'error' };

const listeners = new Set<(toast: Toast) => void>();
let next = 1;

export function showToast(message: string, tone: Toast['tone'] = 'success'): void {
  const toast = { id: next++, message, tone };
  for (const listener of listeners) listener(toast);
}

export function onToast(listener: (toast: Toast) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
