"use client";

import { useState, useEffect } from "react";
import { Lock, ArrowRight } from "lucide-react";

const GATE_KEY = "makina-internal-access";
const GATE_PASSWORD = "makina2024";

interface PasswordGateProps {
  children: React.ReactNode;
}

export default function PasswordGate({ children }: PasswordGateProps) {
  const [unlocked, setUnlocked] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const stored = sessionStorage.getItem(GATE_KEY);
    if (stored === "true") setUnlocked(true);
    setChecking(false);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input === GATE_PASSWORD) {
      sessionStorage.setItem(GATE_KEY, "true");
      setUnlocked(true);
    } else {
      setError(true);
      setTimeout(() => setError(false), 1500);
      setInput("");
    }
  };

  if (checking) return null;

  if (unlocked) return <>{children}</>;

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6 animate-fade-in-up">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-lg bg-makina-card border border-makina-border mx-auto">
            <Lock size={20} className="text-makina-accent" />
          </div>
          <h1 className="text-xl font-bold">Internal Access</h1>
          <p className="text-sm text-makina-muted">
            Enter the team password to continue
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Password"
            autoFocus
            className={`w-full rounded-md bg-makina-card border px-4 py-3 text-sm text-makina-text placeholder:text-makina-subtle focus:outline-none transition-colors ${
              error
                ? "border-makina-red focus:border-makina-red"
                : "border-makina-border focus:border-makina-accent/50"
            }`}
          />
          {error && (
            <p className="text-xs text-makina-red font-medium animate-fade-in-up">
              Wrong password. Try again.
            </p>
          )}
          <button
            type="submit"
            disabled={!input.trim()}
            className="w-full flex items-center justify-center gap-2 rounded-md gradient-accent py-3 text-sm font-semibold text-makina-bg transition-all hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Continue
            <ArrowRight size={14} />
          </button>
        </form>

        <p className="text-center text-[11px] text-makina-subtle">
          Makina Pulse &middot; Internal tools
        </p>
      </div>
    </div>
  );
}
