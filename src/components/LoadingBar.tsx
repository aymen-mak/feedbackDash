"use client";

import { createContext, useContext, useState, useCallback, useRef } from "react";

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

  return (
    <Ctx.Provider value={{ start, done }}>
      {visible && <div className="loading-bar" />}
      {children}
    </Ctx.Provider>
  );
}
