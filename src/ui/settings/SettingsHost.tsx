import { useEffect, useState } from "react";
import { SETTINGS_OPEN_EVENT } from "./settingsEvents";
import { SettingsDialog } from "./SettingsDialog";

export function SettingsHost() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener(SETTINGS_OPEN_EVENT, handler);
    return () => window.removeEventListener(SETTINGS_OPEN_EVENT, handler);
  }, []);

  if (!open) {
    return null;
  }
  return <SettingsDialog onClose={() => setOpen(false)} />;
}
