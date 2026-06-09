"use client";

import { useEffect, useState } from "react";

const XL_QUERY = "(min-width: 1280px)";

export function useIsXl(): boolean {
  const [isXl, setIsXl] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(XL_QUERY);
    const sync = () => setIsXl(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return isXl;
}
