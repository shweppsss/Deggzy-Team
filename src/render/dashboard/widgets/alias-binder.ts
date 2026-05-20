// ============================================================================
// Dashboard widget — alias contenteditable binder. Phase TS-14A.
// Side-effect: attaches blur / keydown / paste listeners. Idempotent.
// ============================================================================

export interface AliasBinderHooks {
  /** Save alias to cloud. Returns true on success. */
  saveAlias: (alias: string) => Promise<boolean>;
  /** App-wide toast. */
  toast: (message: string) => void;
}

/**
 * Wire blur/keydown/paste handlers on the alias contenteditable.
 * Idempotent via `data-bound`. The blur handler reads the current value,
 * pushes through saveAlias, and toasts on success/failure. Escape reverts.
 */
export function bindAliasInput(el: HTMLElement, currentAlias: string, hooks: AliasBinderHooks): void {
  if (el.dataset.bound) return;
  el.dataset.bound = '1';

  el.addEventListener('blur', async () => {
    const val = (el.textContent || '').trim();
    if (val === currentAlias) return;
    const ok = await hooks.saveAlias(val);
    if (ok) {
      hooks.toast(val ? `Alias enregistré : ${val}` : 'Alias retiré');
    } else {
      hooks.toast('Échec de sauvegarde — réessaie');
      el.textContent = currentAlias;
    }
  });

  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      el.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      el.textContent = currentAlias;
      el.blur();
    }
  });

  el.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = (e.clipboardData?.getData('text') || '').slice(0, 32);
    document.execCommand('insertText', false, text);
  });
}
