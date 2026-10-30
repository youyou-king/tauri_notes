import { useEffect, useState } from "react";
import {
  resolveShellProfile,
  type ShellProfile,
} from "./profile";

export function useShellProfile(): ShellProfile {
  const [profile, setProfile] = useState(() =>
    resolveShellProfile(window.innerWidth),
  );

  useEffect(() => {
    const update = () =>
      setProfile(resolveShellProfile(window.innerWidth));
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return profile;
}
