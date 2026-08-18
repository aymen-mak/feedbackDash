"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

const STORAGE_KEY = "makina-reviewer-name";

interface ReviewerCtx {
  name: string;
  setName: (name: string) => void;
  promptOpen: boolean;
  openPrompt: () => void;
  closePrompt: () => void;
}

const ReviewerContext = createContext<ReviewerCtx>({
  name: "",
  setName: () => {},
  promptOpen: false,
  openPrompt: () => {},
  closePrompt: () => {},
});

export function ReviewerProvider({ children }: { children: React.ReactNode }) {
  const [name, setNameState] = useState("");
  const [promptOpen, setPromptOpen] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setNameState(stored);
    } catch { /* ignore */ }
  }, []);

  const setName = useCallback((n: string) => {
    setNameState(n);
    try { localStorage.setItem(STORAGE_KEY, n); } catch { /* ignore */ }
  }, []);

  const openPrompt = useCallback(() => setPromptOpen(true), []);
  const closePrompt = useCallback(() => setPromptOpen(false), []);

  return (
    <ReviewerContext.Provider value={{ name, setName, promptOpen, openPrompt, closePrompt }}>
      {children}
    </ReviewerContext.Provider>
  );
}

export function useReviewer() {
  return useContext(ReviewerContext);
}
