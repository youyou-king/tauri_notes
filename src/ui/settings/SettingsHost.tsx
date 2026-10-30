import { useEffect, useState } from "react";
import { SettingsDialog } from "./SettingsDialog";

export function SettingsHost() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("settings:open", handler);
    return () => window.removeEventListener("settings:open", handler);
  }, []);

  if (!open) {
    return null;
  }
  return <SettingsDialog onClose={() => setOpen(false)} />;
}
