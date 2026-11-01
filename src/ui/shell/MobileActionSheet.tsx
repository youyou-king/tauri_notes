import { useEffect } from "react";

export type MobileActionItem = {
  id: string;
  label: string;
  tone?: "default" | "danger";
  disabled?: boolean;
  onSelect: () => void;
};

export function MobileActionSheet({
  title,
  items,
  onClose,
}: {
  title: string;
  items: MobileActionItem[];
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="mobile-sheet-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="mobile-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <h3>{title}</h3>
        <div className="mobile-sheet-actions">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.tone === "danger" ? "danger" : undefined}
              disabled={item.disabled}
              onClick={() => {
                item.onSelect();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        <button type="button" className="mobile-sheet-cancel" onClick={onClose}>
          取消
        </button>
      </div>
    </div>
  );
}