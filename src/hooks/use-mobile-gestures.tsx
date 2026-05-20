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
   * applyScale: zoom 값을 받아 app-scale-root와 portal-root에 적용
   *
   * 핵심 수정:
   * - app-scale-root: transformOrigin을 "top left"로 고정하되,
   *   스크롤 보정은 호출부(handleTouchMove, handleDoubleTap)에서 수행
   * - portal-root: 항상 현재 스크롤 위치와 scale을 반영하여
   *   다이얼로그가 실제 뷰포트 중앙에 보이도록 역변환(counter-transform) 적용
   */
  const applyScale = useCallback((zoom: number) => {
    currentZoomRef.current = zoom;
    const totalScale = fitScaleRef.current * zoom;

    const scaleRoot = document.getElementById("app-scale-root") as HTMLElement | null;
    const portalRoot = document.getElementById("portal-root") as HTMLElement | null;

    if (!scaleRoot) return;

    // app-scale-root: top-left 기준으로 scale (스크롤 보정은 호출부에서)
    scaleRoot.style.transform = `scale(${totalScale})`;
    scaleRoot.style.transformOrigin = "top left";
    scaleRoot.style.width = `${DESKTOP_WIDTH}px`;
    scaleRoot.style.minWidth = `${DESKTOP_WIDTH}px`;

    // portal-root: 뷰포트 기준으로 배치 — scale의 역변환을 적용해
    // 다이얼로그가 항상 실제 화면 중앙에 뜨도록 함
    if (portalRoot) {
      // 현재 스크롤 위치 (scale 적용 후 기준)
      const scrollX = window.scrollX;
      const scrollY = window.scrollY;

      // 역변환: portal-root 자체를 scale의 반대로 축소하면
      // 내부의 fixed 다이얼로그가 뷰포트 좌표 그대로 동작함
      portalRoot.style.position = "fixed";
      portalRoot.style.top = "0";
      portalRoot.style.left = "0";
      // 역스케일로 실제 뷰포트 크기와 동일한 논리 영역 확보
      portalRoot.style.width = `${window.innerWidth / totalScale}px`;
      portalRoot.style.height = `${window.innerHeight / totalScale}px`;
      // 스크롤 오프셋을 역산하여 고정 위치 보정
      portalRoot.style.transform = `scale(${totalScale}) translate(${scrollX / totalScale}px, ${scrollY / totalScale}px)`;
      portalRoot.style.transformOrigin = "top left";
      portalRoot.style.zIndex = "9999";
      portalRoot.style.pointerEvents = "none";
    }
  }, []);

  /**
   * portal-root의 scroll offset 보정을 스크롤 이벤트마다 갱신
   * (스크롤할 때 다이얼로그가 따라 움직이지 않도록)
   */
  const syncPortalScroll = useCallback(() => {
    const portalRoot = document.getElementById("portal-root") as HTMLElement | null;
    if (!portalRoot || !portalRoot.style.transform) return;

    const totalScale = fitScaleRef.current * currentZoomRef.current;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    portalRoot.style.width = `${window.innerWidth / totalScale}px`;
    portalRoot.style.height = `${window.innerHeight / totalScale}px`;
    portalRoot.style.transform = `scale(${totalScale}) translate(${scrollX / totalScale}px, ${scrollY / totalScale}px)`;
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
    // 스크롤 시 portal-root(다이얼로그) 위치 동기화
    window.addEventListener("scroll", syncPortalScroll, { passive: true });

    return () => {
      document.removeEventListener("touchstart", handleDoubleTap);
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("resize", scheduleRecalc);
      window.visualViewport?.removeEventListener("resize", scheduleRecalc);
      window.removeEventListener("scroll", syncPortalScroll);
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
  }, [desktopMode, applyScale, syncPortalScroll]);
}
