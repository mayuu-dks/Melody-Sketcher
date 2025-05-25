
import { useState, useEffect } from 'react';

export function useIsPortrait() {
  // Initialize state by immediately evaluating window dimensions
  const [isPortrait, setIsPortrait] = useState(() => {
    if (typeof window === 'undefined') return true; // Default for SSR or non-browser
    return window.innerHeight >= window.innerWidth;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateOrientation = () => {
      setIsPortrait(window.innerHeight >= window.innerWidth);
    };

    // Call it once to set initial state correctly after mount (if window is available)
    updateOrientation(); 

    window.addEventListener('resize', updateOrientation);
    // Using 'orientationchange' might be redundant if 'resize' covers it,
    // but it's harmless to keep for broader compatibility.
    window.addEventListener('orientationchange', updateOrientation);

    return () => {
      window.removeEventListener('resize', updateOrientation);
      window.removeEventListener('orientationchange', updateOrientation);
    };
  }, []);

  return isPortrait;
}

    