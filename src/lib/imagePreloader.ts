// Global image preloader — keeps HTMLImageElement refs alive
// so the browser doesn't evict them from memory cache, preventing
// visible re-loading flicker when components remount their <img> tags.
const imageCache = new Map<string, HTMLImageElement>();

export function preloadImage(src: string): void {
  if (!src || imageCache.has(src)) return;
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  imageCache.set(src, img);
}

export function preloadImages(srcs: Iterable<string | undefined | null>): void {
  for (const s of srcs) {
    if (s) preloadImage(s);
  }
}

export function isImagePreloaded(src: string): boolean {
  return imageCache.has(src);
}
