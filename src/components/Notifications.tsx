"use client";

import { createContext, useContext, useState, useCallback, useRef } from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

type NotifType = "success" | "warning" | "info" | "error";

interface Notif {
  id: string;
  type: NotifType;
  message: string;
  exiting?: boolean;
}

interface NotifCtx {
  notify: (type: NotifType, message: string) => void;
}

const Ctx = createContext<NotifCtx>({ notify: () => {} });

export function useNotifications() {
  return useContext(Ctx);
}

const typeStyles: Record<NotifType, { bg: string; border: string; icon: React.ReactNode }> = {
  success: { bg: "bg-green-500/15", border: "border-green-500/30", icon: <CheckCircle2 size={14} className="text-green-400" /> },
  warning: { bg: "bg-amber-500/15", border: "border-amber-500/30", icon: <AlertTriangle size={14} className="text-amber-400" /> },
  info: { bg: "bg-blue-500/15", border: "border-blue-500/30", icon: <Info size={14} className="text-blue-400" /> },
  error: { bg: "bg-red-500/15", border: "border-red-500/30", icon: <AlertTriangle size={14} className="text-red-400" /> },
};

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: string) => {
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, exiting: true } : n)));
    setTimeout(() => setNotifs((prev) => prev.filter((n) => n.id !== id)), 300);
  }, []);

  const notify = useCallback((type: NotifType, message: string) => {
    const id = `notif-${++counter.current}`;
    setNotifs((prev) => [...prev.slice(-4), { id, type, message }]);
    setTimeout(() => dismiss(id), 4000);
  }, [dismiss]);

  return (
    <Ctx.Provider value={{ notify }}>
      {children}
      <div className="fixed top-4 right-4 z-[9998] flex flex-col gap-2 max-w-sm pointer-events-none">
        {notifs.map((n) => {
          const s = typeStyles[n.type];
          return (
            <div
              key={n.id}
              className={`${n.exiting ? "toast-exit" : "toast-enter"} pointer-events-auto flex items-center gap-2 rounded-lg ${s.bg} border ${s.border} px-4 py-2.5 shadow-lg backdrop-blur-sm`}
            >
              {s.icon}
              <span className="text-xs font-medium text-makina-text flex-1">{n.message}</span>
              <button onClick={() => dismiss(n.id)} className="text-makina-muted hover:text-makina-text transition-colors shrink-0">
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}
