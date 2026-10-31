import { useEffect, useState } from "react";
import { onAppEvent } from "../../kernel/events";
import { SETTINGS_OPEN_EVENT } from "./settingsEvents";
import { SettingsDialog } from "./SettingsDialog";

export function SettingsHost() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    return onAppEvent(SETTINGS_OPEN_EVENT, () => setOpen(true));
  }, []);

  if (!open) {
    return null;
  }
  return <SettingsDialog onClose={() => setOpen(false)} />;
}
