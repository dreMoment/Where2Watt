import { useEffect, useState } from "react";

export function useMobileViewport(query = "(max-width: 768px)") {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mediaQueryList = window.matchMedia(query);
    const onChange = (event: MediaQueryList | MediaQueryListEvent) => {
      setIsMobile(event.matches);
    };

    onChange(mediaQueryList);

    if (typeof mediaQueryList.addEventListener === "function") {
      mediaQueryList.addEventListener("change", onChange);
    } else {
      mediaQueryList.addListener(onChange);
    }

    return () => {
      if (typeof mediaQueryList.removeEventListener === "function") {
        mediaQueryList.removeEventListener("change", onChange);
      } else {
        mediaQueryList.removeListener(onChange);
      }
    };
  }, [query]);

  return isMobile;
}