import { useMemo } from "react";
import { useShellProfile } from "../ui/shell/useShellProfile";
import type { Runtime } from "./contracts";
import { createRuntime } from "./createRuntime";

export function useRuntime(): Runtime {
  const profile = useShellProfile();
  return useMemo(() => createRuntime(profile), [profile]);
}