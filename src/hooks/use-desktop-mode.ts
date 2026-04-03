import { useEffect, useState } from 'react';

const DESKTOP_MODE_KEY = 'quest-sim-desktop-mode';

export function useDesktopModeState() {
  const [desktopMode, setDesktopMode] = useState(() => {
    try {
      return localStorage.getItem(DESKTOP_MODE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(DESKTOP_MODE_KEY, String(desktopMode));
    } catch {
      // noop
    }
  }, [desktopMode]);

  return { desktopMode, setDesktopMode };
}
