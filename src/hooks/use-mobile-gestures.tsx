import { useEffect, useRef, useCallback } from "react";

const DESKTOP_WIDTH = 1366;
const DOUBLE_TAP_DELAY = 300;
const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const DEFAULT_VIEWPORT = "width=device-width, initial-scale=1.0, user-scalable=yes, viewport-fit=cover";

export function useMobileGestures(desktopMode: boolean) {
  const currentZoomRef = useRef(1);
  const fitScaleRef = useRef(1);
  const pinchStartDistRef = useRef(0);
  const pinchStartZoomRef = useRef(1);
  const lastTapRef = useRef(0);
  const pinchStartCenterRef = useRef({ x: 0, y: 0 });
  const pinchStartScrollRef = useRef({ x: 0, y: 0 });

  /**
   * applyScale: app-scale-root만 scale 적용
   *
   * 핵심 변경:
   * - portal-root는 app-scale-root 안에 있으므로 transform을 따로 적용하지 않음
   * - portal-root는 CSS로만 제어 (아래 useEffect에서 position:absolute+inset-0 설정)
   * - 다이얼로그의 fixed 포지션은 portal-root가 같은 transform 컨텍스트 안에
   *   있으므로 portal-root 기준 fixed로 동작 → 배경과 함께 확대됨
   */
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
      if (portalRoot) {
        // 모바일 일반 모드: portal-root는 기본 상태로
        portalRoot.style.cssText = "";
      }
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

    // portal-root를 app-scale-root 안에서 전체 영역을 덮는 레이어로 설정
    // position: absolute + inset-0 → 부모(app-scale-root)의 transform에 종속됨
    // 이로써 다이얼로그가 배경과 정확히 같은 좌표계에서 확대/축소됨
    if (portalRoot) {
      portalRoot.style.position = "absolute";
      portalRoot.style.top = "0";
      portalRoot.style.left = "0";
      portalRoot.style.right = "0";
      portalRoot.style.bottom = "0";
      portalRoot.style.width = `${DESKTOP_WIDTH}px`;
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

    // 더블탭 줌 — 탭한 위치를 중심으로 확대
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

        // 탭 위치의 콘텐츠 좌표를 보존하도록 스크롤 보정
        const contentX = (window.scrollX + tapX) / oldTotalScale;
        const contentY = (window.scrollY + tapY) / oldTotalScale;

        applyScale(next);

        window.scrollTo(contentX * newTotalScale - tapX, contentY * newTotalScale - tapY);
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
        pinchStartCenterRef.current = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        };
        pinchStartScrollRef.current = {
          x: window.scrollX,
          y: window.scrollY,
        };
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dist = getDistance(e.touches[0], e.touches[1]);
        const ratio = dist / pinchStartDistRef.current;
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, pinchStartZoomRef.current * ratio));

        const oldTotalScale = fitScaleRef.current * pinchStartZoomRef.current;
        const newTotalScale = fitScaleRef.current * newZoom;

        // 핀치 중심점이 가리키는 콘텐츠 좌표
        const cx = pinchStartCenterRef.current.x;
        const cy = pinchStartCenterRef.current.y;
        const contentX = (pinchStartScrollRef.current.x + cx) / oldTotalScale;
        const contentY = (pinchStartScrollRef.current.y + cy) / oldTotalScale;

        applyScale(newZoom);

        // 핀치 중심이 같은 콘텐츠 위치를 가리키도록 스크롤 보정
        window.scrollTo(contentX * newTotalScale - cx, contentY * newTotalScale - cy);
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
