import { useEffect, useState } from "react";
import { onAppEvent } from "../../kernel/events";
import { SETTINGS_OPEN_EVENT } from "./settingsEvents";
import { SettingsDialog } from "./SettingsDialog";

export function SettingsHost() {
  const [open, setOpen] = useState(false);
  const [sectionId, setSectionId] = useState<string | undefined>();

  useEffect(() => {
    return onAppEvent(SETTINGS_OPEN_EVENT, (payload) => {
      setSectionId(payload?.sectionId);
      setOpen(true);
    });
  }, []);

  if (!open) {
    return null;
  }
  return (
    <SettingsDialog
      initialSectionId={sectionId}
      onClose={() => setOpen(false)}
    />
  );
}
