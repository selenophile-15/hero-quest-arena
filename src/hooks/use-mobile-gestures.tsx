import { useEffect, useRef, useCallback } from 'react';

const DESKTOP_WIDTH = 1366;
const DOUBLE_TAP_DELAY = 300;
const ZOOM_LEVELS = [1, 1.5, 2, 3]; // relative to base scale
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 5;
const DEFAULT_VIEWPORT = 'width=device-width, initial-scale=1.0, user-scalable=yes, viewport-fit=cover';

/**
 * Handles pinch-to-zoom and double-tap zoom for desktop mode on mobile.
 * Locks the page to a 1366px desktop layout first, then zooms that fixed layout.
 */
export function useMobileGestures(desktopMode: boolean) {
  const zoomLevelRef = useRef(0); // index into ZOOM_LEVELS
  const lastTapRef = useRef(0);
  const fitScaleRef = useRef(1);
  const currentZoomRef = useRef(1);

  // Pinch state
  const pinchStartDistRef = useRef(0);
  const pinchStartZoomRef = useRef(1);

  const applyZoom = useCallback((zoom: number) => {
    currentZoomRef.current = zoom;
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById('root');
    const totalZoom = fitScaleRef.current * zoom;

    html.style.zoom = String(totalZoom);
    html.style.width = `${DESKTOP_WIDTH}px`;
    html.style.minWidth = `${DESKTOP_WIDTH}px`;
    body.style.width = `${DESKTOP_WIDTH}px`;
    body.style.minWidth = `${DESKTOP_WIDTH}px`;
    body.style.maxWidth = 'none';
    body.style.minHeight = `${100 / totalZoom}vh`;
    body.style.overflowX = 'auto';

    if (root) {
      root.style.width = `${DESKTOP_WIDTH}px`;
      root.style.minWidth = `${DESKTOP_WIDTH}px`;
      root.style.maxWidth = 'none';
    }
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById('root');
    const viewport = document.querySelector('meta[name="viewport"]');

    if (!desktopMode) {
      html.style.zoom = '';
      html.style.width = '';
      html.style.minWidth = '';
      body.style.width = '';
      body.style.minWidth = '';
      body.style.maxWidth = '';
      body.style.minHeight = '';
      body.style.overflowX = '';
      if (root) {
        root.style.width = '';
        root.style.minWidth = '';
        root.style.maxWidth = '';
      }
      if (viewport) viewport.setAttribute('content', DEFAULT_VIEWPORT);
      return;
    }

    zoomLevelRef.current = 0;
    currentZoomRef.current = 1;

    if (viewport) {
      viewport.setAttribute('content', `width=${DESKTOP_WIDTH}, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover`);
    }

    const recalcFitScale = () => {
      const visualWidth = window.visualViewport?.width || window.innerWidth || window.screen.width;
      const layoutWidth = document.documentElement.clientWidth || window.innerWidth || DESKTOP_WIDTH;
      const desktopViewportApplied = layoutWidth >= DESKTOP_WIDTH * 0.95;

      fitScaleRef.current = desktopViewportApplied ? 1 : Math.min(visualWidth / DESKTOP_WIDTH, 1);
      applyZoom(currentZoomRef.current);
    };

    const scheduleRecalc = () => {
      requestAnimationFrame(() => requestAnimationFrame(recalcFitScale));
    };

    scheduleRecalc();

    // Double-tap handler
    const handleDoubleTap = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const now = Date.now();
      const delta = now - lastTapRef.current;
      lastTapRef.current = now;

      if (delta < DOUBLE_TAP_DELAY && delta > 0) {
        e.preventDefault();
        const nextZoom = ZOOM_LEVELS.find((level) => level > currentZoomRef.current + 0.05) ?? ZOOM_LEVELS[0];
        zoomLevelRef.current = ZOOM_LEVELS.indexOf(nextZoom);
        applyZoom(nextZoom);
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
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, pinchStartZoomRef.current * ratio));
        applyZoom(newZoom);
        const nearestIdx = ZOOM_LEVELS.findIndex((level) => Math.abs(level - newZoom) < 0.05);
        zoomLevelRef.current = nearestIdx >= 0 ? nearestIdx : 0;
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
    window.addEventListener('resize', scheduleRecalc);
    window.visualViewport?.addEventListener('resize', scheduleRecalc);

    return () => {
      document.removeEventListener('touchstart', handleDoubleTap);
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('resize', scheduleRecalc);
      window.visualViewport?.removeEventListener('resize', scheduleRecalc);
      html.style.zoom = '';
      html.style.width = '';
      html.style.minWidth = '';
      body.style.width = '';
      body.style.minWidth = '';
      body.style.maxWidth = '';
      body.style.minHeight = '';
      body.style.overflowX = '';
      if (root) {
        root.style.width = '';
        root.style.minWidth = '';
        root.style.maxWidth = '';
      }
      if (viewport) {
        viewport.setAttribute('content', DEFAULT_VIEWPORT);
      }
    };
  }, [desktopMode, applyZoom]);
}
