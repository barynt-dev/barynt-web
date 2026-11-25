"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
} from "react";
import type { Toast } from "@/types";

interface UIState {
  toast: Toast | null;
}

type UIAction = { type: "TOAST"; toast: Omit<Toast, "id"> | null };

function reducer(state: UIState, a: UIAction): UIState {
  return { ...state, toast: a.toast ? { id: Date.now(), ...a.toast } : null };
}

interface UIValue {
  ui: UIState;
  toast: (msg: string) => void;
}

const Ctx = createContext<UIValue | null>(null);

/** Like `useUI`, for what also runs outside the provider — `null` there. */
export function useOptionalUI() {
  return useContext(Ctx);
}

export function useUI() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useUI must be used within UIProvider");
  return ctx;
}

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [ui, dispatch] = useReducer(reducer, { toast: null });

  useEffect(() => {
    if (!ui.toast) return;
    const t = setTimeout(() => dispatch({ type: "TOAST", toast: null }), 2600);
    return () => clearTimeout(t);
  }, [ui.toast]);

  const toast = useCallback(
    (msg: string) => dispatch({ type: "TOAST", toast: { msg } }),
    [],
  );

  return <Ctx.Provider value={{ ui, toast }}>{children}</Ctx.Provider>;
}
