import type { JSX, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base(size: number, props: SVGProps<SVGSVGElement>): SVGProps<SVGSVGElement> {
  return { width: size, height: size, viewBox: "0 0 24 24", fill: "none", ...props };
}

export function SearchIcon({ size = 14, ...rest }: IconProps): JSX.Element {
  return (
    <svg {...base(size, { stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", ...rest })}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function CompareIcon({ size = 15, ...rest }: IconProps): JSX.Element {
  return (
    <svg {...base(size, { stroke: "currentColor", strokeWidth: 1.5, ...rest })}>
      <rect x="3" y="4" width="7.5" height="16" rx="1" />
      <rect x="13.5" y="4" width="7.5" height="16" rx="1" />
    </svg>
  );
}

export function StudyIcon({ size = 15, ...rest }: IconProps): JSX.Element {
  return (
    <svg {...base(size, { stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", ...rest })}>
      <path d="M12 3v3M12 18v3M4.2 7.5l2.6 1.5M17.2 15l2.6 1.5M4.2 16.5l2.6-1.5M17.2 9l2.6-1.5" />
      <circle cx="12" cy="12" r="3.2" />
    </svg>
  );
}

export function SunIcon({ size = 15, ...rest }: IconProps): JSX.Element {
  return (
    <svg {...base(size, { stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", ...rest })}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

export function MoonIcon({ size = 15, ...rest }: IconProps): JSX.Element {
  return (
    <svg {...base(size, { stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round", ...rest })}>
      <path d="M20 14.5A8.2 8.2 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z" />
    </svg>
  );
}

export function KeyIcon({ size = 15, ...rest }: IconProps): JSX.Element {
  return (
    <svg {...base(size, { stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", ...rest })}>
      <circle cx="8" cy="14" r="4" />
      <path d="m11 11 8-8M17 5l2 2M14 8l2 2" />
    </svg>
  );
}

export function ChevronRightIcon({ size = 11, ...rest }: IconProps): JSX.Element {
  return (
    <svg {...base(size, { stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...rest })}>
      <path d="m9 5 7 7-7 7" />
    </svg>
  );
}

export function PrevIcon({ size = 15, ...rest }: IconProps): JSX.Element {
  return (
    <svg {...base(size, { stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", ...rest })}>
      <path d="m15 5-7 7 7 7" />
    </svg>
  );
}

export function NextIcon({ size = 15, ...rest }: IconProps): JSX.Element {
  return (
    <svg {...base(size, { stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", ...rest })}>
      <path d="m9 5 7 7-7 7" />
    </svg>
  );
}

export function SpeakIcon({ size = 15, ...rest }: IconProps): JSX.Element {
  return (
    <svg {...base(size, { stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", ...rest })}>
      <path d="M4 9v6h4l5 4V5L8 9H4z" />
      <path d="M16.5 8.5a5 5 0 0 1 0 7" />
    </svg>
  );
}

export function StopIcon({ size = 15, ...rest }: IconProps): JSX.Element {
  return (
    <svg {...base(size, { stroke: "currentColor", strokeWidth: 1.6, strokeLinejoin: "round", ...rest })}>
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
    </svg>
  );
}

export function ImageIcon({ size = 15, ...rest }: IconProps): JSX.Element {
  return (
    <svg {...base(size, { stroke: "currentColor", strokeWidth: 1.5, strokeLinejoin: "round", ...rest })}>
      <rect x="3" y="4" width="18" height="16" rx="1.5" />
      <circle cx="8.5" cy="9.5" r="1.6" />
      <path d="m4 17 5.2-5.2a1.5 1.5 0 0 1 2.1 0L15 15.5M13.8 14.2l1.8-1.8a1.5 1.5 0 0 1 2.1 0L20 14.5" />
    </svg>
  );
}

export function StarIcon({ size = 15, filled = false, ...rest }: IconProps & { filled?: boolean }): JSX.Element {
  return (
    <svg
      {...base(size, {
        stroke: "currentColor",
        strokeWidth: 1.5,
        strokeLinejoin: "round",
        fill: filled ? "currentColor" : "none",
        ...rest
      })}
    >
      <path d="m12 3.6 2.6 5.3 5.9.85-4.25 4.15 1 5.85L12 17l-5.25 2.75 1-5.85L3.5 9.75l5.9-.85z" />
    </svg>
  );
}

export function NoteIcon({ size = 15, ...rest }: IconProps): JSX.Element {
  return (
    <svg {...base(size, { stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round", ...rest })}>
      <path d="M5 4h9l5 5v11H5z" />
      <path d="M14 4v5h5" />
    </svg>
  );
}

export function HighlightIcon({ size = 15, ...rest }: IconProps): JSX.Element {
  return (
    <svg {...base(size, { stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round", ...rest })}>
      <path d="m15.5 4.5 4 4-8 8H7.5v-4z" />
      <path d="M4 21h16" />
    </svg>
  );
}

export function MoreIcon({ size = 15, ...rest }: IconProps): JSX.Element {
  return (
    <svg {...base(size, { fill: "currentColor", ...rest })}>
      <circle cx="5.5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="18.5" cy="12" r="1.6" />
    </svg>
  );
}

export function TrashIcon({ size = 15, ...rest }: IconProps): JSX.Element {
  return (
    <svg {...base(size, { stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round", ...rest })}>
      <path d="M4.5 6.5h15M9.5 6.5V4.5h5v2M6.5 6.5 7.5 20h9l1-13.5M10.5 10v6M13.5 10v6" />
    </svg>
  );
}

export function CopyIcon({ size = 15, ...rest }: IconProps): JSX.Element {
  return (
    <svg {...base(size, { stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round", ...rest })}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M15 5.5A1.5 1.5 0 0 0 13.5 4H6a2 2 0 0 0-2 2v7.5A1.5 1.5 0 0 0 5.5 15" />
    </svg>
  );
}

export function CloseIcon({ size = 15, ...rest }: IconProps): JSX.Element {
  return (
    <svg {...base(size, { stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", ...rest })}>
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

export function DownloadIcon({ size = 15, ...rest }: IconProps): JSX.Element {
  return (
    <svg {...base(size, { stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", ...rest })}>
      <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14" />
    </svg>
  );
}

export function OfflineReadyIcon({ size = 15, ...rest }: IconProps): JSX.Element {
  return (
    <svg {...base(size, { stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", ...rest })}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.3 12.2 2.5 2.5 4.9-5" />
    </svg>
  );
}

export function PlusIcon({ size = 15, ...rest }: IconProps): JSX.Element {
  return (
    <svg {...base(size, { stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", ...rest })}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function CheckIcon({ size = 15, ...rest }: IconProps): JSX.Element {
  return (
    <svg {...base(size, { stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", ...rest })}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

export function ArrowUpIcon({ size = 15, ...rest }: IconProps): JSX.Element {
  return (
    <svg {...base(size, { stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", ...rest })}>
      <path d="M12 19V5M6.5 10.5 12 5l5.5 5.5" />
    </svg>
  );
}

export function ArrowDownIcon({ size = 15, ...rest }: IconProps): JSX.Element {
  return (
    <svg {...base(size, { stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", ...rest })}>
      <path d="M12 5v14M6.5 13.5 12 19l5.5-5.5" />
    </svg>
  );
}

export function BookOpenIcon({ size = 15, ...rest }: IconProps): JSX.Element {
  return (
    <svg {...base(size, { stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round", ...rest })}>
      <path d="M3 5.5c3-1 6-1 9 1 3-2 6-2 9-1V19c-3-1-6-1-9 1-3-2-6-2-9-1z" />
      <path d="M12 6.5V20" />
    </svg>
  );
}

export function QuoteIcon({ size = 15, ...rest }: IconProps): JSX.Element {
  return (
    <svg {...base(size, { fill: "currentColor", ...rest })}>
      <path d="M5 17.5c0-4.5 1.6-8.2 5-10.5l1 1.3c-1.9 1.6-2.9 3.4-3 5.4H10v4.3H5zm8.5 0c0-4.5 1.6-8.2 5-10.5l1 1.3c-1.9 1.6-2.9 3.4-3 5.4h2v4.3h-5z" />
    </svg>
  );
}

export function SermonIcon({ size = 15, ...rest }: IconProps): JSX.Element {
  return (
    <svg {...base(size, { stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round", ...rest })}>
      <path d="M6 3.5h9l3 3V20.5H6z" />
      <path d="M9 9h6M9 12.5h6M9 16h3.5" />
    </svg>
  );
}

// Rich-text toolbar (components/Study/StudyEditor.tsx).

const strokeProps = { stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export function BulletListIcon({ size = 16, ...rest }: IconProps): JSX.Element {
  return (
    <svg {...base(size, { ...strokeProps, ...rest })}>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <circle cx="4.5" cy="6" r="0.9" fill="currentColor" />
      <circle cx="4.5" cy="12" r="0.9" fill="currentColor" />
      <circle cx="4.5" cy="18" r="0.9" fill="currentColor" />
    </svg>
  );
}

export function NumberedListIcon({ size = 16, ...rest }: IconProps): JSX.Element {
  return (
    <svg {...base(size, { ...strokeProps, ...rest })}>
      <path d="M10 6h10M10 12h10M10 18h10" />
      <path d="M4 4.5 5.2 4v4" strokeWidth={1.3} />
      <path d="M3.8 15.2c.3-.6.8-.9 1.4-.9.7 0 1.2.5 1.2 1.1 0 .9-1.2 1.5-2.6 2.8h2.7" strokeWidth={1.3} />
    </svg>
  );
}

function alignIcon(lines: [number, number][]) {
  return function AlignIcon({ size = 16, ...rest }: IconProps): JSX.Element {
    return (
      <svg {...base(size, { ...strokeProps, ...rest })}>
        <path d={lines.map(([x1, x2], i) => `M${x1} ${5 + i * 4.67}H${x2}`).join("")} />
      </svg>
    );
  };
}

export const AlignLeftIcon = alignIcon([[4, 20], [4, 14], [4, 20], [4, 14]]);
export const AlignCenterIcon = alignIcon([[4, 20], [7, 17], [4, 20], [7, 17]]);
export const AlignRightIcon = alignIcon([[4, 20], [10, 20], [4, 20], [10, 20]]);
export const AlignJustifyIcon = alignIcon([[4, 20], [4, 20], [4, 20], [4, 20]]);

export function RuleIcon({ size = 16, ...rest }: IconProps): JSX.Element {
  return (
    <svg {...base(size, { ...strokeProps, ...rest })}>
      <path d="M5 12h14" />
    </svg>
  );
}

export function LinkIcon({ size = 16, ...rest }: IconProps): JSX.Element {
  return (
    <svg {...base(size, { ...strokeProps, ...rest })}>
      <path d="M10 8H7.5a4 4 0 0 0 0 8H10M14 8h2.5a4 4 0 0 1 0 8H14M8.5 12h7" />
    </svg>
  );
}

export function ImagePlusIcon({ size = 16, ...rest }: IconProps): JSX.Element {
  return (
    <svg {...base(size, { ...strokeProps, ...rest })}>
      <path d="M13 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
      <path d="m4 16 4.5-4.5a1.5 1.5 0 0 1 2.1 0L17 18" />
      <path d="m14 15 1.5-1.5a1.5 1.5 0 0 1 2.1 0L20 16" />
      <path d="M18 3v6M15 6h6" />
      <circle cx="9" cy="8.5" r="1.3" />
    </svg>
  );
}

export function VideoIcon({ size = 16, ...rest }: IconProps): JSX.Element {
  return (
    <svg {...base(size, { ...strokeProps, ...rest })}>
      <rect x="3" y="5" width="18" height="14" rx="4" />
      <path d="M10.5 9.5v5l4-2.5z" fill="currentColor" />
    </svg>
  );
}
