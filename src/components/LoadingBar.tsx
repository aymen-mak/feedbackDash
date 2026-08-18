"use client";

import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";

interface LoadingBarCtx {
  start: () => void;
  done: () => void;
}

const Ctx = createContext<LoadingBarCtx>({ start: () => {}, done: () => {} });

export function useLoadingBar() {
  return useContext(Ctx);
}

export function LoadingBarProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const count = useRef(0);

  const start = useCallback(() => {
    count.current += 1;
    setVisible(true);
  }, []);

  const done = useCallback(() => {
    count.current = Math.max(0, count.current - 1);
    if (count.current === 0) {
      setTimeout(() => {
        if (count.current === 0) setVisible(false);
      }, 200);
    }
  }, []);

  // Show the bar on every route change, app-wide. Living in the provider (not the
  // navbar) means it also fires from pages without a navbar, e.g. the landing page.
  const pathname = usePathname();
  const prevPath = useRef(pathname);
  useEffect(() => {
    if (prevPath.current === pathname) return;
    prevPath.current = pathname;
    start();
    const t = setTimeout(done, 400);
    return () => clearTimeout(t);
  }, [pathname, start, done]);

  return (
    <Ctx.Provider value={{ start, done }}>
      {visible && <div className="loading-bar" />}
      {children}
    </Ctx.Provider>
  );
}
