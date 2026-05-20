import { useEffect, useRef, useCallback } from "react";

const DESKTOP_WIDTH = 1366;
const DOUBLE_TAP_DELAY = 300;
const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const DEFAULT_VIEWPORT = "width=device-width, initial-scale=1.0, user-scalable=yes, viewport-fit=cover";

export function useMobileGestures(desktopMode: boolean) {
  const currentZoomRef = useRef(1);
  const fitScaleRef = useRef(1);

  // 핀치 줌
  const pinchStartDistRef = useRef(0);
  const pinchStartZoomRef = useRef(1);
  const pinchStartCenterRef = useRef({ x: 0, y: 0 });
  const pinchStartScrollRef = useRef({ x: 0, y: 0 });

  // 더블탭
  const lastTapRef = useRef(0);

  // 단일 손가락 pan (확대 상태에서 드래그로 이동)
  const panStartRef = useRef<{ x: number; y: number } | null>(null);
  const panScrollStartRef = useRef({ x: 0, y: 0 });
  const isPanningRef = useRef(false);

  const applyScale = useCallback((zoom: number) => {
    currentZoomRef.current = zoom;
    const totalScale = fitScaleRef.current * zoom;

    const scaleRoot = document.getElementById("app-scale-root") as HTMLElement | null;
    if (!scaleRoot) return;

    scaleRoot.style.transform = `scale(${totalScale})`;
    scaleRoot.style.transformOrigin = "top left";
    scaleRoot.style.width = `${DESKTOP_WIDTH}px`;
    scaleRoot.style.minWidth = `${DESKTOP_WIDTH}px`;
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
      if (portalRoot) portalRoot.style.cssText = "";
      if (viewport) viewport.setAttribute("content", DEFAULT_VIEWPORT);
      document.documentElement.removeAttribute("data-desktop");
      return;
    }

    currentZoomRef.current = 1;
    document.documentElement.setAttribute("data-desktop", "true");

    if (viewport) {
      viewport.setAttribute(
        "content",
        `width=${DESKTOP_WIDTH}, initial-scale=1, maximum-scale=10, user-scalable=no, viewport-fit=cover`,
      );
    }

    if (portalRoot) {
      // portal-root는 app-scale-root 바깥(transform 없음)에 있으므로
      // fixed 포지셔닝이 뷰포트 기준으로 정상 동작함
      portalRoot.style.position = "fixed";
      portalRoot.style.inset = "0";
      portalRoot.style.pointerEvents = "none";
      portalRoot.style.zIndex = "9999";
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

    // ── 헬퍼 ──────────────────────────────────────────────
    const getDistance = (t1: Touch, t2: Touch) => {
      const dx = t1.clientX - t2.clientX;
      const dy = t1.clientY - t2.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    /**
     * 터치 시작 지점에서 내부 스크롤 가능한 요소인지 확인
     * - 다이얼로그 내부 스크롤 영역은 pan이 아닌 내부 스크롤로 처리해야 함
     */
    const isScrollableElement = (el: Element | null): boolean => {
      if (!el) return false;
      const style = window.getComputedStyle(el);
      const overflowY = style.overflowY;
      const overflowX = style.overflowX;
      const scrollable =
        overflowY === "auto" || overflowY === "scroll" || overflowX === "auto" || overflowX === "scroll";
      if (scrollable && (el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth)) {
        return true;
      }
      return isScrollableElement(el.parentElement);
    };

    // ── 더블탭 줌 ─────────────────────────────────────────
    const handleDoubleTap = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const now = Date.now();
      const delta = now - lastTapRef.current;
      lastTapRef.current = now;
      if (delta < DOUBLE_TAP_DELAY && delta > 0) {
        e.preventDefault();

        const tapX = e.touches[0].clientX;
        const tapY = e.touches[0].clientY;
        const oldTotalScale = fitScaleRef.current * currentZoomRef.current;
        const next = currentZoomRef.current < 1.4 ? 1.5 : currentZoomRef.current < 2.4 ? 2.5 : 1;
        const newTotalScale = fitScaleRef.current * next;

        const contentX = (window.scrollX + tapX) / oldTotalScale;
        const contentY = (window.scrollY + tapY) / oldTotalScale;

        applyScale(next);
        window.scrollTo(contentX * newTotalScale - tapX, contentY * newTotalScale - tapY);
      }
    };

    // ── 터치 시작 ─────────────────────────────────────────
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        // 핀치 시작
        isPanningRef.current = false;
        panStartRef.current = null;

        pinchStartDistRef.current = getDistance(e.touches[0], e.touches[1]);
        pinchStartZoomRef.current = currentZoomRef.current;
        pinchStartCenterRef.current = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        };
        pinchStartScrollRef.current = { x: window.scrollX, y: window.scrollY };
      } else if (e.touches.length === 1 && currentZoomRef.current > 1) {
        // 확대 상태에서 단일 손가락 → pan 준비
        // 단, 내부 스크롤 가능한 요소 위에서는 pan 하지 않음
        const target = e.target as Element;
        if (!isScrollableElement(target)) {
          panStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
          panScrollStartRef.current = { x: window.scrollX, y: window.scrollY };
          isPanningRef.current = false; // 실제 이동 감지 후 true로
        }
      }
    };

    // ── 터치 이동 ─────────────────────────────────────────
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        // 핀치 줌
        e.preventDefault();
        const dist = getDistance(e.touches[0], e.touches[1]);
        const ratio = dist / pinchStartDistRef.current;
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, pinchStartZoomRef.current * ratio));

        const oldTotalScale = fitScaleRef.current * pinchStartZoomRef.current;
        const newTotalScale = fitScaleRef.current * newZoom;

        const cx = pinchStartCenterRef.current.x;
        const cy = pinchStartCenterRef.current.y;
        const contentX = (pinchStartScrollRef.current.x + cx) / oldTotalScale;
        const contentY = (pinchStartScrollRef.current.y + cy) / oldTotalScale;

        applyScale(newZoom);
        window.scrollTo(contentX * newTotalScale - cx, contentY * newTotalScale - cy);
      } else if (e.touches.length === 1 && panStartRef.current && currentZoomRef.current > 1) {
        // 단일 손가락 pan
        const dx = e.touches[0].clientX - panStartRef.current.x;
        const dy = e.touches[0].clientY - panStartRef.current.y;

        // 5px 이상 움직여야 pan으로 확정 (탭과 구분)
        if (!isPanningRef.current && Math.sqrt(dx * dx + dy * dy) < 5) return;
        isPanningRef.current = true;

        e.preventDefault();
        window.scrollTo(panScrollStartRef.current.x - dx, panScrollStartRef.current.y - dy);
      }
    };

    // ── 터치 끝 ───────────────────────────────────────────
    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinchStartDistRef.current = 0;
      if (e.touches.length === 0) {
        panStartRef.current = null;
        isPanningRef.current = false;
      }
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
