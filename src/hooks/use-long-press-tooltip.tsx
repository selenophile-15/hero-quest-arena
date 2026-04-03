import { useRef, useCallback } from 'react';

const LONG_PRESS_DURATION = 800; // ms

/**
 * Returns touch handlers to trigger tooltip open on long-press (mobile).
 * Usage: spread the returned props onto the tooltip trigger element.
 */
export function useLongPressTooltip(onOpen: () => void, onClose: () => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    isLongPressRef.current = false;
    timerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      onOpen();
    }, LONG_PRESS_DURATION);
  }, [onOpen]);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (isLongPressRef.current) {
      e.preventDefault(); // Prevent click after long press
      // Auto-close tooltip after a delay
      setTimeout(onClose, 3000);
    }
  }, [onClose]);

  const onTouchMove = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return { onTouchStart, onTouchEnd, onTouchMove };
}
