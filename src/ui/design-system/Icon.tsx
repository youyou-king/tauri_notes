import type { ReactNode } from "react";

const PATHS: Record<string, ReactNode> = {
  menu: (
    <>
      <path d="M3 5h10M3 8h10M3 11h10" />
    </>
  ),
  back: <path d="M8 3 4 8l4 5M4 8h8" />,
  close: <path d="m4 4 8 8M12 4l-8 8" />,
  minimize: <path d="M3 8h10" />,
  maximize: <rect x="3.5" y="3.5" width="9" height="9" rx="1" />,
  restore: (
    <>
      <path d="M5 5V3.5h7.5V11H11" />
      <rect x="3.5" y="6.5" width="7" height="7" rx="1" />
    </>
  ),
  console: (
    <>
      <path d="m4 5 3 3-3 3" />
      <path d="M8.5 11h4" />
    </>
  ),
  outline: (
    <>
      <path d="M3 4h4v8H3z" />
      <path d="M9 4h4v8H9z" />
      <path d="M3 8h10" />
    </>
  ),
  map: (
    <>
      <rect x="2.5" y="6.5" width="4" height="3.5" rx="1" />
      <rect x="9.5" y="3" width="4" height="3.5" rx="1" />
      <rect x="9.5" y="9.5" width="4" height="3.5" rx="1" />
      <path d="M6.5 8h3M8 4.8v6.4" />
    </>
  ),
  library: (
    <>
      <path d="M3 3.5h3v9H3zM7 3.5h3v9H7z" />
      <path d="m11 4 2.5 8" />
    </>
  ),
  document: (
    <>
      <path d="M4 2.5h5l3 3v8H4z" />
      <path d="M9 2.5v3h3M6 8h4M6 10.5h4" />
    </>
  ),
  board: (
    <>
      <rect x="3" y="3" width="4" height="4" rx="1" />
      <rect x="9" y="3" width="4" height="4" rx="1" />
      <rect x="3" y="9" width="4" height="4" rx="1" />
      <rect x="9" y="9" width="4" height="4" rx="1" />
    </>
  ),
  folder: <path d="M2.5 4h4l1.5 2H13.5v7h-11z" />,
  idea: (
    <>
      <path d="M6 12h4M6.5 14h3" />
      <path d="M5.5 10.5a4 4 0 1 1 5 0c-.6.5-.8 1-.8 1.5H6.3c0-.5-.2-1-.8-1.5Z" />
    </>
  ),
  edit: (
    <>
      <path d="m3 11 .5-2.5L10 2l2 2-6.5 6.5z" />
      <path d="M3 13h10" />
    </>
  ),
  download: (
    <>
      <path d="M8 2v8M5 7l3 3 3-3M3 13h10" />
    </>
  ),
  archive: (
    <>
      <path d="M3 3h10v3H3zM4 6v7h8V6" />
      <path d="M6.5 9h3" />
    </>
  ),
  search: (
    <>
      <circle cx="7.5" cy="7.5" r="3.5" />
      <path d="m10.5 10.5 3 3" />
    </>
  ),
};

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  size = 16,
}: {
  name: IconName;
  size?: number;
}) {
  return (
    <svg
      className="ui-icon"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
