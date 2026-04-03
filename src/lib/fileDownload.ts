import { toast } from '@/hooks/use-toast';

const IN_APP_BROWSER_RE = /(KAKAOTALK|NAVER|FBAN|FBAV|Instagram|Line|; wv|\bwv\b|WebView|Lovable)/i;

function isInAppBrowser() {
  return IN_APP_BROWSER_RE.test(navigator.userAgent);
}

function shouldPreferShare() {
  return isInAppBrowser() || window.matchMedia?.('(pointer: coarse)').matches;
}

async function tryShareFile(file: File) {
  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
    share?: (data?: ShareData) => Promise<void>;
  };

  if (!shouldPreferShare() || !nav.share) return false;

  const shareData: ShareData = { files: [file], title: file.name };
  if (nav.canShare && !nav.canShare(shareData)) return false;

  try {
    await nav.share(shareData);
    return true;
  } catch (error) {
    if ((error as DOMException)?.name === 'AbortError') return true;
    return false;
  }
}

export async function saveBlobFile(blob: Blob, filename: string, fallbackMessage?: string) {
  const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });

  if (await tryShareFile(file)) return;

  const url = URL.createObjectURL(blob);
  try {
    if (isInAppBrowser()) {
      const opened = window.open(url, '_blank', 'noopener,noreferrer');
      toast({
        title: opened ? '파일을 열었어요' : '파일을 준비했어요',
        description: fallbackMessage || '자동 저장이 안 되면 열린 화면에서 저장하거나 공유해 주세요.',
      });

      if (!opened) {
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.click();
      }
      return;
    }

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener noreferrer';
    link.click();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}

export async function saveCanvasImage(
  canvas: HTMLCanvasElement,
  filename: string,
  type: 'image/png' | 'image/jpeg' = 'image/png',
  quality = 0.92,
) {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  if (!blob) throw new Error('이미지 생성에 실패했습니다.');

  await saveBlobFile(
    blob,
    filename,
    '자동 저장이 안 되면 열린 화면에서 길게 눌러 저장하거나 공유해 주세요.',
  );
}
