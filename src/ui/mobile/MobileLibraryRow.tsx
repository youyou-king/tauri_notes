import { useLongPress } from "../interaction/useLongPress";
import { useSwipeLeft } from "../interaction/useSwipeLeft";
import type { MobileDocumentLink } from "./types";

export function MobileLibraryRow({
  document,
  onOpen,
  onMenu,
}: {
  document: MobileDocumentLink;
  onOpen: (id: string) => void;
  onMenu: (document: MobileDocumentLink) => void;
}) {
  const press = useLongPress({
    onLongPress: () => onMenu(document),
  });
  const swipe = useSwipeLeft({ onSwipe: () => onMenu(document) });
  return (
    <button
      type="button"
      className="mobile-pressable"
      {...press}
      onPointerDown={(event) => {
        press.onPointerDown(event);
        swipe.onPointerDown(event);
      }}
      onPointerUp={(event) => {
        press.onPointerUp();
        swipe.onPointerUp(event);
      }}
      onPointerCancel={() => {
        press.onPointerCancel();
        swipe.onPointerCancel();
      }}
      onPointerLeave={() => {
        press.onPointerLeave();
        swipe.onPointerLeave();
      }}
      onClick={() => onOpen(document.id)}
    >
      <strong>{document.title}</strong>
      <span>{document.id}</span>
    </button>
  );
}