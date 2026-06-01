import { useEffect, useRef, useCallback } from "react";

const DESKTOP_WIDTH = 1366;
const DOUBLE_TAP_DELAY = 300;
const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const DEFAULT_VIEWPORT = "width=device-width, initial-scale=1.0, user-scalable=yes, viewport-fit=cover";

export function useMobileGestures(desktopMode: boolean) {
  const currentZoomRef = useRef(1);
  const fitScaleRef = useRef(1);
  const translateXRef = useRef(0);
  const translateYRef = useRef(0);
  const pinchStartDistRef = useRef(0);
  const pinchStartZoomRef = useRef(1);
  const pinchStartMidRef = useRef({ x: 0, y: 0 });
  const pinchStartTranslateRef = useRef({ x: 0, y: 0 });
  const lastTapRef = useRef(0);
  const lastTapPosRef = useRef({ x: 0, y: 0 });

  const clampTranslate = useCallback((tx: number, ty: number, totalScale: number) => {
    const vw = window.visualViewport?.width ?? window.innerWidth;
    const vh = window.visualViewport?.height ?? window.innerHeight;
    const contentW = DESKTOP_WIDTH * totalScale;
    const contentH = window.innerHeight * totalScale;
    // Allow some pan slack but keep content from disappearing
    const minTx = Math.min(0, vw - contentW);
    const maxTx = Math.max(0, vw - contentW);
    const minTy = Math.min(0, vh - contentH);
    const maxTy = Math.max(0, vh - contentH);
    return {
      x: Math.max(minTx, Math.min(maxTx, tx)),
      y: Math.max(minTy, Math.min(maxTy, ty)),
    };
  }, []);

  const applyScale = useCallback(
    (zoom: number, anchor?: { x: number; y: number; prevTranslate?: { x: number; y: number }; prevZoom?: number }) => {
      const prevZoom = anchor?.prevZoom ?? currentZoomRef.current;
      const prevTranslate = anchor?.prevTranslate ?? { x: translateXRef.current, y: translateYRef.current };
      const fit = fitScaleRef.current;
      const prevTotal = fit * prevZoom;
      const newTotal = fit * zoom;

      let tx: number;
      let ty: number;
      if (zoom <= 1.0001) {
        tx = 0;
        ty = 0;
      } else if (anchor) {
        // Anchor point in viewport coords; keep logical point under anchor fixed.
        const logicalX = (anchor.x - prevTranslate.x) / prevTotal;
        const logicalY = (anchor.y - prevTranslate.y) / prevTotal;
        tx = anchor.x - logicalX * newTotal;
        ty = anchor.y - logicalY * newTotal;
      } else {
        // Scale-only: keep same translate ratio
        const ratio = prevTotal === 0 ? 1 : newTotal / prevTotal;
        tx = prevTranslate.x * ratio;
        ty = prevTranslate.y * ratio;
      }

      const clamped = clampTranslate(tx, ty, newTotal);
      tx = clamped.x;
      ty = clamped.y;

      currentZoomRef.current = zoom;
      translateXRef.current = tx;
      translateYRef.current = ty;

      const scaleRoot = document.getElementById("app-scale-root") as HTMLElement | null;
      const portalRoot = document.getElementById("portal-root") as HTMLElement | null;

      if (!scaleRoot) return;

      const transform = `translate(${tx}px, ${ty}px) scale(${newTotal})`;
      const logicalHeight = newTotal > 0 ? window.innerHeight / newTotal : window.innerHeight;
      scaleRoot.style.transform = transform;
      scaleRoot.style.transformOrigin = "top left";
      scaleRoot.style.width = `${DESKTOP_WIDTH}px`;
      scaleRoot.style.minWidth = `${DESKTOP_WIDTH}px`;
      scaleRoot.style.minHeight = `${logicalHeight}px`;

      // portal-root: mirror transform so fixed dialogs sit in the same scaled coordinate space.
      // Height MUST equal innerHeight / totalScale so that `top:50%` of portal-root, once
      // scaled by totalScale, equals innerHeight/2 — the visual center of the screen.
      if (portalRoot) {
        portalRoot.style.position = "fixed";
        portalRoot.style.top = "0";
        portalRoot.style.left = "0";
        portalRoot.style.width = `${DESKTOP_WIDTH}px`;
        portalRoot.style.minWidth = `${DESKTOP_WIDTH}px`;
        portalRoot.style.height = `${logicalHeight}px`;
        portalRoot.style.transform = transform;
        portalRoot.style.transformOrigin = "top left";
        portalRoot.style.zIndex = "9999";
        portalRoot.style.pointerEvents = "none";
      }
    },
    [clampTranslate],
  );

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
      document.documentElement.removeAttribute("data-desktop");
      return;
    }

    currentZoomRef.current = 1;
    translateXRef.current = 0;
    translateYRef.current = 0;
    document.documentElement.setAttribute("data-desktop", "true");

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

    // 더블탭 줌 (탭 위치 기준)
    const handleDoubleTap = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const now = Date.now();
      const delta = now - lastTapRef.current;
      const touch = e.touches[0];
      const pos = { x: touch.clientX, y: touch.clientY };
      const prevPos = lastTapPosRef.current;
      lastTapRef.current = now;
      lastTapPosRef.current = pos;
      const dx = pos.x - prevPos.x;
      const dy = pos.y - prevPos.y;
      const movedClose = Math.hypot(dx, dy) < 40;
      if (delta < DOUBLE_TAP_DELAY && delta > 0 && movedClose) {
        e.preventDefault();
        const next = currentZoomRef.current < 1.4 ? 1.5 : currentZoomRef.current < 2.4 ? 2.5 : 1;
        applyScale(next, { x: pos.x, y: pos.y });
      }
    };

    // 핀치 줌 (중심점 기준)
    const getDistance = (t1: Touch, t2: Touch) => {
      const dx = t1.clientX - t2.clientX;
      const dy = t1.clientY - t2.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };
    const getMid = (t1: Touch, t2: Touch) => ({
      x: (t1.clientX + t2.clientX) / 2,
      y: (t1.clientY + t2.clientY) / 2,
    });

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pinchStartDistRef.current = getDistance(e.touches[0], e.touches[1]);
        pinchStartZoomRef.current = currentZoomRef.current;
        pinchStartMidRef.current = getMid(e.touches[0], e.touches[1]);
        pinchStartTranslateRef.current = { x: translateXRef.current, y: translateYRef.current };
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dist = getDistance(e.touches[0], e.touches[1]);
        const ratio = dist / (pinchStartDistRef.current || 1);
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, pinchStartZoomRef.current * ratio));
        const mid = pinchStartMidRef.current;
        applyScale(newZoom, {
          x: mid.x,
          y: mid.y,
          prevTranslate: pinchStartTranslateRef.current,
          prevZoom: pinchStartZoomRef.current,
        });
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
      document.documentElement.removeAttribute("data-desktop");
    };
  }, [desktopMode, applyScale]);
}
