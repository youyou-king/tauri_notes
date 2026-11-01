import { createContext, useContext, type ReactNode } from "react";
import type { Runtime, RuntimeServices } from "./contracts";

const RuntimeContext = createContext<Runtime | null>(null);

export function RuntimeProvider({
  runtime,
  children,
}: {
  runtime: Runtime;
  children: ReactNode;
}) {
  return (
    <RuntimeContext.Provider value={runtime}>
      {children}
    </RuntimeContext.Provider>
  );
}

export function useRuntimeServices(): RuntimeServices {
  const runtime = useContext(RuntimeContext);
  if (!runtime) {
    throw new Error("RuntimeProvider is missing");
  }
  return runtime.services;
}