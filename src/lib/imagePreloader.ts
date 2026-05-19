const imageCache = new Map<string, HTMLImageElement>();

export function preloadImage(src: string): void {
  if (!src || imageCache.has(src)) return;
  const img = new Image();
  img.decoding = "async";
  img.loading = "eager";
  img.onerror = () => {
    imageCache.delete(src);
  };
  img.src = src;
  imageCache.set(src, img);
}

export function preloadImages(srcs: Iterable<string | undefined | null>): void {
  for (const s of srcs) {
    if (s) preloadImage(s);
  }
}

// 이미지 목록을 모두 로드 완료될 때까지 기다리는 함수
export function preloadImagesAndWait(srcs: (string | undefined | null)[]): Promise<void> {
  const promises = srcs
    .filter((s): s is string => !!s)
    .map((src) => {
      if (imageCache.has(src)) return Promise.resolve(); // 이미 캐시됨
      return new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          imageCache.set(src, img);
          resolve();
        };
        img.onerror = () => resolve(); // 실패해도 블로킹하지 않음
        img.src = src;
        imageCache.set(src, img);
      });
    });
  return Promise.all(promises).then(() => undefined);
}

export function isImagePreloaded(src: string): boolean {
  return imageCache.has(src);
}
