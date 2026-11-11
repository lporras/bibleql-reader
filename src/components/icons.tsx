import type { JSX, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base(size: number, props: SVGProps<SVGSVGElement>): SVGProps<SVGSVGElement> {
  return { width: size, height: size, viewBox: "0 0 24 24", fill: "none", ...props };
}

// OpenAI's approved sign-in button logo (developers.openai.com/assets/siwc/
// sign-in-buttons/chatgpt-logo-white.svg). Don't redraw or recolor it.
export function ChatgptLogo({ size = 18, ...rest }: IconProps): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 21 21" fill="none" aria-hidden="true" {...rest}>
      <path
        fill="white"
        d="M11.8102 19.1625C11.2327 19.1625 10.6841 19.0528 10.1643 18.8334C9.64459 18.6139 9.18259 18.3078 8.77834 17.9151C8.33944 18.0653 7.88322 18.1404 7.40967 18.1404C6.63582 18.1404 5.91972 17.9498 5.26137 17.5686C4.60302 17.1875 4.07172 16.6677 3.66747 16.0094C3.27477 15.351 3.07842 14.6176 3.07842 13.8091C3.07842 13.4742 3.12462 13.1103 3.21702 12.7176C2.75502 12.2903 2.39697 11.7994 2.14287 11.245C1.88877 10.679 1.76172 10.09 1.76172 9.47785C1.76172 8.85415 1.89454 8.25355 2.16019 7.67605C2.42584 7.09855 2.79544 6.6019 3.26899 6.1861C3.75409 5.75875 4.31427 5.46422 4.94952 5.30252C5.07657 4.64417 5.34222 4.05512 5.74647 3.53537C6.16227 3.00407 6.67047 2.58827 7.27107 2.28797C7.87167 1.98767 8.51269 1.83752 9.19414 1.83752C9.77164 1.83752 10.3203 1.94725 10.84 2.1667C11.3598 2.38615 11.8218 2.69222 12.226 3.08492C12.6649 2.93477 13.1211 2.8597 13.5947 2.8597C14.3685 2.8597 15.0846 3.05027 15.743 3.43142C16.4013 3.81257 16.9269 4.33232 17.3196 4.99067C17.7238 5.64902 17.9259 6.38245 17.9259 7.19095C17.9259 7.5259 17.8797 7.88973 17.7873 8.28242C18.2493 8.70977 18.6074 9.20643 18.8615 9.77238C19.1156 10.3268 19.2426 10.91 19.2426 11.5222C19.2426 12.1459 19.1098 12.7465 18.8442 13.324C18.5785 13.9015 18.2031 14.4039 17.718 14.8313C17.2445 15.2471 16.6901 15.5358 16.0548 15.6975C15.9278 16.3559 15.6564 16.9449 15.2406 17.4647C14.8363 17.996 14.3339 18.4118 13.7333 18.7121C13.1327 19.0124 12.4917 19.1625 11.8102 19.1625ZM7.53094 16.9969C8.10844 16.9969 8.61087 16.8756 9.03822 16.6331L12.2953 14.762C12.4108 14.6811 12.4686 14.5714 12.4686 14.4328V12.9429L8.27592 15.351C8.02182 15.5012 7.76772 15.5012 7.51362 15.351L4.23919 13.4626C4.23919 13.4973 4.23342 13.5377 4.22187 13.5839C4.22187 13.6301 4.22187 13.6994 4.22187 13.7918C4.22187 14.3808 4.36047 14.9237 4.63767 15.4203C4.92642 15.9054 5.32489 16.2866 5.83309 16.5638C6.34129 16.8525 6.90724 16.9969 7.53094 16.9969ZM7.70419 14.1729C7.77349 14.2076 7.83702 14.2249 7.89477 14.2249C7.95252 14.2249 8.01027 14.2076 8.06802 14.1729L9.36739 13.4279L5.19207 11.0024C4.93797 10.8523 4.81092 10.6271 4.81092 10.3268V6.56725C4.23342 6.82135 3.77142 7.21405 3.42492 7.74535C3.07842 8.2651 2.90517 8.8426 2.90517 9.47785C2.90517 10.0438 3.04954 10.5866 3.33829 11.1064C3.62704 11.6261 4.00242 12.0189 4.46442 12.2845L7.70419 14.1729ZM11.8102 18.0191C12.4224 18.0191 12.9768 17.8805 13.4734 17.6033C13.9701 17.3261 14.3628 16.9449 14.6515 16.4598C14.9403 15.9747 15.0846 15.4319 15.0846 14.8313V11.0891C15.0846 10.9505 15.0269 10.8465 14.9114 10.7772L13.5947 10.0149V14.8486C13.5947 15.1489 13.4676 15.3741 13.2135 15.5243L9.93912 17.4127C10.5051 17.817 11.1288 18.0191 11.8102 18.0191ZM12.4686 11.6781V9.32192L10.5108 8.21312L8.53579 9.32192V11.6781L10.5108 12.7869L12.4686 11.6781ZM7.40967 6.15145C7.40967 5.85115 7.53672 5.62592 7.79082 5.47577L11.0652 3.58735C10.4993 3.1831 9.87559 2.98097 9.19414 2.98097C8.58199 2.98097 8.02759 3.11957 7.53094 3.39677C7.03429 3.67397 6.64159 4.05512 6.35284 4.54022C6.07564 5.02532 5.93704 5.56817 5.93704 6.16878V9.89365C5.93704 10.0323 5.99479 10.142 6.11029 10.2228L7.40967 10.9851V6.15145ZM16.2108 14.4328C16.7883 14.1787 17.2445 13.786 17.5794 13.2547C17.9259 12.7234 18.0992 12.1459 18.0992 11.5222C18.0992 10.9562 17.9548 10.4134 17.6661 9.89365C17.3773 9.3739 17.0019 8.9812 16.5399 8.71555L13.3002 6.84445C13.2309 6.79825 13.1673 6.78092 13.1096 6.79248C13.0518 6.79248 12.9941 6.8098 12.9363 6.84445L11.637 7.5721L15.8296 10.0149C15.9567 10.0842 16.0491 10.1766 16.1068 10.2921C16.1761 10.3961 16.2108 10.5231 16.2108 10.6733V14.4328ZM12.7284 5.6317C12.9825 5.47 13.2366 5.47 13.4907 5.6317L16.7825 7.55477C16.7825 7.47393 16.7825 7.36997 16.7825 7.24292C16.7825 6.68852 16.6439 6.163 16.3667 5.66635C16.101 5.15815 15.7141 4.7539 15.2059 4.4536C14.7093 4.1533 14.1318 4.00315 13.4734 4.00315C12.8959 4.00315 12.3935 4.12442 11.9661 4.36697L8.70904 6.23808C8.59354 6.31892 8.53579 6.42865 8.53579 6.56725V8.0572L12.7284 5.6317Z"
      />
    </svg>
  );
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

export function FlagIcon({ size = 15, ...rest }: IconProps): JSX.Element {
  return (
    <svg {...base(size, { stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round", ...rest })}>
      <path d="M5.5 21V4M5.5 4.5h11l-2.5 4 2.5 4h-11" />
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
