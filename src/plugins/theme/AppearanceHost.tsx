import { useEffect, useState } from "react";
import {
  getAppliedDecorations,
  type DecorationAppearance,
} from "./appearanceApplier";

export function isDecorationVisible(
  decoration: DecorationAppearance,
  viewportWidth: number,
): boolean {
  return (
    decoration.hideBelow === undefined ||
    viewportWidth >= decoration.hideBelow
  );
}

function anchorStyle(anchor: DecorationAppearance["anchor"]) {
  switch (anchor) {
    case "top-left":
      return { top: 0, left: 0 };
    case "top-right":
      return { top: 0, right: 0 };
    case "bottom-right":
      return { bottom: 0, right: 0 };
    case "bottom-left":
      return { bottom: 0, left: 0 };
  }
}

export function AppearanceHost() {
  const [decorations, setDecorations] = useState<DecorationAppearance[]>(
    getAppliedDecorations,
  );
  const [viewportWidth, setViewportWidth] = useState(window.innerWidth);

  useEffect(() => {
    const update = () => setDecorations(getAppliedDecorations());
    window.addEventListener("appearance:applied", update);
    return () => window.removeEventListener("appearance:applied", update);
  }, []);

  useEffect(() => {
    const update = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <div className="appearance-host" aria-hidden="true">
      <div className="appearance-wallpaper" />
      <div className="appearance-overlay" />
      {decorations
        .filter((decoration) =>
          isDecorationVisible(decoration, viewportWidth),
        )
        .map((decoration, index) => (
          <div
            key={`${decoration.src}:${index}`}
            className="appearance-decoration"
            style={{
              ...anchorStyle(decoration.anchor),
              width: decoration.width,
              opacity: decoration.opacity,
              backgroundImage: `url("${decoration.src}")`,
            }}
            data-hide-below={decoration.hideBelow}
          />
        ))}
    </div>
  );
}
