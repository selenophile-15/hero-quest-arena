import { useEffect, useRef, useCallback } from 'react';

const DESKTOP_WIDTH = 1366;
const DOUBLE_TAP_DELAY = 300;
const ZOOM_LEVELS = [1, 1.5, 2, 3]; // relative to base scale

/**
 * Handles pinch-to-zoom and double-tap zoom for desktop mode on mobile.
 * Uses CSS zoom on <html> for universal coverage (including portals/dialogs).
 */
export function useMobileGestures(desktopMode: boolean) {
  const zoomLevelRef = useRef(0); // index into ZOOM_LEVELS
  const lastTapRef = useRef(0);
  const baseScaleRef = useRef(1);
  const currentZoomRef = useRef(1);

  // Pinch state
  const pinchStartDistRef = useRef(0);
  const pinchStartZoomRef = useRef(1);

  const applyZoom = useCallback((zoom: number) => {
    currentZoomRef.current = zoom;
    const html = document.documentElement;
    const totalZoom = baseScaleRef.current * zoom;
    html.style.zoom = String(totalZoom);
    // Adjust body height so scrolling works correctly
    document.body.style.minHeight = `${100 / totalZoom}vh`;
  }, []);

  useEffect(() => {
    if (!desktopMode) {
      document.documentElement.style.zoom = '';
      document.body.style.minHeight = '';
      return;
    }

    // Calculate base scale to fit DESKTOP_WIDTH into screen
    const screenW = window.screen.width || window.innerWidth;
    const base = screenW / DESKTOP_WIDTH;
    baseScaleRef.current = base < 1 ? base : 1;
    zoomLevelRef.current = 0;
    currentZoomRef.current = 1;

    // Set viewport to desktop width
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      viewport.setAttribute('content', `width=${DESKTOP_WIDTH}, initial-scale=${baseScaleRef.current}, user-scalable=no`);
    }

    // Apply initial zoom
    applyZoom(1);

    // Double-tap handler
    const handleDoubleTap = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const now = Date.now();
      const delta = now - lastTapRef.current;
      lastTapRef.current = now;

      if (delta < DOUBLE_TAP_DELAY && delta > 0) {
        e.preventDefault();
        zoomLevelRef.current = (zoomLevelRef.current + 1) % ZOOM_LEVELS.length;
        applyZoom(ZOOM_LEVELS[zoomLevelRef.current]);
      }
    };

    // Pinch handlers
    const getDistance = (t1: Touch, t2: Touch) => {
      const dx = t1.clientX - t2.clientX;
      const dy = t1.clientY - t2.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pinchStartDistRef.current = getDistance(e.touches[0], e.touches[1]);
        pinchStartZoomRef.current = currentZoomRef.current;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dist = getDistance(e.touches[0], e.touches[1]);
        const ratio = dist / pinchStartDistRef.current;
        const newZoom = Math.max(0.5, Math.min(5, pinchStartZoomRef.current * ratio));
        applyZoom(newZoom);
        // Reset double-tap level tracking
        zoomLevelRef.current = 0;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        pinchStartDistRef.current = 0;
      }
    };

    document.addEventListener('touchstart', handleDoubleTap, { passive: false });
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleDoubleTap);
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.documentElement.style.zoom = '';
      document.body.style.minHeight = '';
      if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, user-scalable=yes');
      }
    };
  }, [desktopMode, applyZoom]);
}
