import { useEffect } from 'react';

/**
 * Keyboard activation for clickable non-button elements (Enter / Space).
 * Usage: <div role="button" tabIndex={0} onClick={fn} onKeyDown={onActivateKey(fn)} />
 */
export const onActivateKey = (fn) => (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fn(e);
  }
};

/**
 * Calls `onEscape` when the Escape key is pressed while `active` is true.
 * Call it before any early `return null` so hook order stays stable.
 */
export function useEscapeKey(active, onEscape) {
  useEffect(() => {
    if (!active || !onEscape) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onEscape();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [active, onEscape]);
}
