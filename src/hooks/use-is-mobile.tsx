
import * as React from "react"

const MOBILE_BREAKPOINT = 768 // md breakpoint in Tailwind

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      setIsMobile(false); // Default to not mobile in SSR or non-browser environments
      return;
    }

    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(mql.matches);
    }
    
    onChange(); // Initial check

    if (mql.addEventListener) {
      mql.addEventListener("change", onChange);
    } else {
      // Fallback for older browsers
      mql.addListener(onChange);
    }
    
    return () => {
      if (mql.removeEventListener) {
        mql.removeEventListener("change", onChange);
      } else {
        // Fallback for older browsers
        mql.removeListener(onChange);
      }
    }
  }, [])

  return isMobile === undefined ? false : isMobile; // Return false during initial undefined state
}
