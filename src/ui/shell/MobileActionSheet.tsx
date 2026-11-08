import { Button } from "../design-system/Button";
import { ModalSurface } from "../dialog/ModalSurface";

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
  return (
    <ModalSurface
      className="mobile-sheet-backdrop"
      panelClassName="mobile-sheet"
      ariaLabel={title}
      onClose={onClose}
    >
      <h3>{title}</h3>
      <div className="mobile-sheet-actions">
        {items.map((item) => (
          <Button
            key={item.id}
            variant={item.tone === "danger" ? "danger" : "secondary"}
            disabled={item.disabled}
            onClick={() => {
              item.onSelect();
            }}
          >
            {item.label}
          </Button>
        ))}
      </div>
      <Button className="mobile-sheet-cancel" onClick={onClose}>
        取消
      </Button>
    </ModalSurface>
  );
}
