import { useEffect, useRef, useCallback } from "react";

const DESKTOP_WIDTH = 1366;
const DOUBLE_TAP_DELAY = 300;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 5;
const DEFAULT_VIEWPORT = "width=device-width, initial-scale=1.0, user-scalable=yes, viewport-fit=cover";

export function useMobileGestures(desktopMode: boolean) {
  const currentZoomRef = useRef(1);
  const fitScaleRef = useRef(1);
  const pinchStartDistRef = useRef(0);
  const pinchStartZoomRef = useRef(1);
  const lastTapRef = useRef(0);

  const applyScale = useCallback((zoom: number) => {
    currentZoomRef.current = zoom;
    const totalScale = fitScaleRef.current * zoom;

    const scaleRoot = document.getElementById("app-scale-root") as HTMLElement | null;
    const portalRoot = document.getElementById("portal-root") as HTMLElement | null;

    if (!scaleRoot) return;

    scaleRoot.style.transform = `scale(${totalScale})`;
    scaleRoot.style.transformOrigin = "top left";
    scaleRoot.style.width = `${DESKTOP_WIDTH}px`;
    scaleRoot.style.minWidth = `${DESKTOP_WIDTH}px`;

    // portal-root: scale과 동일한 변환 적용 + fixed 포지션으로 좌상단 고정
    if (portalRoot) {
      portalRoot.style.position = "fixed";
      portalRoot.style.top = "0";
      portalRoot.style.left = "0";
      portalRoot.style.width = `${DESKTOP_WIDTH}px`;
      portalRoot.style.minWidth = `${DESKTOP_WIDTH}px`;
      portalRoot.style.height = `${(DESKTOP_WIDTH / totalScale) * (window.innerHeight / window.innerWidth)}px`;
      portalRoot.style.transform = `scale(${totalScale})`;
      portalRoot.style.transformOrigin = "top left";
      portalRoot.style.zIndex = "9999";
      portalRoot.style.pointerEvents = "none"; // 배경 터치 통과
    }
  }, []);

  useEffect(() => {
    const scaleRoot = document.getElementById("app-scale-root") as HTMLElement | null;
    const portalRoot = document.getElementById("portal-root") as HTMLElement | null;
    const viewport = document.querySelector('meta[name="viewport"]');

    if (!desktopMode) {
      if (scaleRoot) {
        scaleRoot.style.transform = "";
        scaleRoot.style.transformOrigin = "";
        scaleRoot.style.width = "";
        scaleRoot.style.minWidth = "";
      }
      if (portalRoot) {
        portalRoot.style.cssText = "";
      }
      if (viewport) viewport.setAttribute("content", DEFAULT_VIEWPORT);
      return;
    }

    currentZoomRef.current = 1;

    if (viewport) {
      viewport.setAttribute(
        "content",
        `width=${DESKTOP_WIDTH}, initial-scale=1, maximum-scale=10, user-scalable=no, viewport-fit=cover`,
      );
    }

    const recalcFitScale = () => {
      const visualWidth = window.visualViewport?.width ?? window.innerWidth;
      fitScaleRef.current = Math.min(visualWidth / DESKTOP_WIDTH, 1);
      applyScale(currentZoomRef.current);
    };

    const scheduleRecalc = () => {
      requestAnimationFrame(() => requestAnimationFrame(recalcFitScale));
    };

    scheduleRecalc();

    // 더블탭 줌
    const handleDoubleTap = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const now = Date.now();
      const delta = now - lastTapRef.current;
      lastTapRef.current = now;
      if (delta < DOUBLE_TAP_DELAY && delta > 0) {
        e.preventDefault();
        const next = currentZoomRef.current < 1.4 ? 1.5 : currentZoomRef.current < 2.4 ? 2.5 : 1;
        applyScale(next);
      }
    };

    // 핀치 줌
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
        applyScale(newZoom);
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinchStartDistRef.current = 0;
    };

    document.addEventListener("touchstart", handleDoubleTap, { passive: false });
    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });
    window.addEventListener("resize", scheduleRecalc);
    window.visualViewport?.addEventListener("resize", scheduleRecalc);

    return () => {
      document.removeEventListener("touchstart", handleDoubleTap);
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("resize", scheduleRecalc);
      window.visualViewport?.removeEventListener("resize", scheduleRecalc);
      if (scaleRoot) {
        scaleRoot.style.transform = "";
        scaleRoot.style.transformOrigin = "";
        scaleRoot.style.width = "";
        scaleRoot.style.minWidth = "";
      }
      if (portalRoot) portalRoot.style.cssText = "";
      if (viewport) viewport.setAttribute("content", DEFAULT_VIEWPORT);
    };
  }, [desktopMode, applyScale]);
}
