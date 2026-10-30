import { useEffect, useRef, useState } from "react";
import { restoreAppliedAppearance } from "./appearanceApplier";
import { ThemeMenu } from "./ui/ThemeMenu";

export function ThemeToolbarItem() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // ThemeProvider effects run after plugin effects; restore in a later task
    // so the appearance pack is applied on top of provider tokens.
    void Promise.resolve().then(restoreAppliedAppearance);
    const handler = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const openHandler = () => setOpen(true);
    window.addEventListener("mousedown", handler);
    window.addEventListener("theme:open", openHandler);
    return () => {
      window.removeEventListener("mousedown", handler);
      window.removeEventListener("theme:open", openHandler);
    };
  }, []);

  return (
    <div className="toolbar-menu" ref={rootRef}>
      <button
        type="button"
        className={open ? "active" : ""}
        onClick={() => setOpen((current) => !current)}
      >
        主题 ▾
      </button>
      {open && (
        <ThemeMenu
          onClose={() => setOpen(false)}
          onOpenSettings={() => {
            setOpen(false);
            window.dispatchEvent(new CustomEvent("settings:open"));
          }}
        />
      )}
    </div>
  );
}
