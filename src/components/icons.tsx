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
