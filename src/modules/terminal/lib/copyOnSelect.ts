/**
 * Debounced copy-on-select handler factory.
 *
 * xterm's `onSelectionChange` fires on every cell flipped during a drag, so
 * we coalesce calls with a short debounce and only copy when the selection
 * has actually changed since the last successful write. Empty selections
 * (deselection) are a no-op so the user's clipboard contents are preserved.
 */
export type CopyOnSelectHandler = {
  /** Invoke on each `onSelectionChange` event. */
  notify: (selection: string) => void;
  /** Cancel the pending timer (call from slot teardown). */
  dispose: () => void;
};

export type CopyOnSelectOptions = {
  isEnabled: () => boolean;
  copy: (text: string) => void;
  debounceMs?: number;
  /** Injectable for tests; defaults to globalThis.setTimeout/clearTimeout. */
  schedule?: (fn: () => void, ms: number) => unknown;
  cancel?: (handle: unknown) => void;
};

export function createCopyOnSelectHandler(
  options: CopyOnSelectOptions,
): CopyOnSelectHandler {
  const {
    isEnabled,
    copy,
    debounceMs = 50,
    schedule = (fn, ms) => setTimeout(fn, ms),
    cancel = (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  } = options;

  let timer: unknown = null;
  let pending: string | null = null;
  let lastCopied: string | null = null;

  function flush(): void {
    timer = null;
    const text = pending;
    pending = null;
    if (text === null || text.length === 0) return;
    if (text === lastCopied) return;
    if (!isEnabled()) return;
    lastCopied = text;
    copy(text);
  }

  return {
    notify(selection: string) {
      if (!isEnabled()) {
        // Don't accumulate state when the feature is off — the next enable
        // should start clean.
        if (timer !== null) {
          cancel(timer);
          timer = null;
        }
        pending = null;
        return;
      }
      if (selection.length === 0) {
        // Empty selection (deselect): cancel pending writes but keep
        // `lastCopied` so re-selecting the same text doesn't re-copy.
        if (timer !== null) {
          cancel(timer);
          timer = null;
        }
        pending = null;
        return;
      }
      pending = selection;
      if (timer === null) {
        timer = schedule(flush, debounceMs);
      }
    },
    dispose() {
      if (timer !== null) {
        cancel(timer);
        timer = null;
      }
      pending = null;
    },
  };
}
