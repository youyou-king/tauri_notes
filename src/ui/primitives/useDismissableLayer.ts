import { useEffect, useRef, type RefObject } from "react";

/**
 * Shared dismissal semantics for floating surfaces. Pointer events check the
 * anchored element; Escape is only handled while the layer is open. Dialog
 * backdrops are ignored so a modal opened above a menu does not close it.
 */
export function useDismissableLayer({
  open,
  onClose,
  anchorRef,
  secondaryRef,
  ignoreDialogBackdrop = true,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  secondaryRef?: RefObject<HTMLElement | null>;
  ignoreDialogBackdrop?: boolean;
}) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      if (
        ignoreDialogBackdrop &&
        target.closest(".app-overlay-backdrop")
      ) {
        return;
      }
      if (!anchorRef.current?.contains(target)) {
        if (secondaryRef?.current?.contains(target)) {
          return;
        }
        closeRef.current();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [anchorRef, ignoreDialogBackdrop, open]);
}
