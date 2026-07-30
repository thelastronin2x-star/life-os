import { SVGProps } from "react";

function Base(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    />
  );
}

export function ThemeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="9" cy="9" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="9" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="10" cy="15" r="1.2" fill="currentColor" stroke="none" />
    </Base>
  );
}

export function AvatarFrameIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <rect x="3" y="4" width="18" height="14" rx="2" />
      <path d="M3 9h18M8 4v5" />
    </Base>
  );
}

export function BriefcaseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M3 21V9l9-6 9 6v12" />
      <path d="M9 21v-8h6v8" />
    </Base>
  );
}

export function GlobeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.5 3.5 6 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-6-3.5-9s1-6.5 3.5-9z" />
    </Base>
  );
}

export function ClockIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </Base>
  );
}

export function BanknoteIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
    </Base>
  );
}

export function CalendarDateIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </Base>
  );
}

export function HeartIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M12 21c-5-4-9-7.5-9-12a5.5 5.5 0 019-4.2A5.5 5.5 0 0121 9c0 4.5-4 8-9 12z" />
    </Base>
  );
}

export function SmartphoneIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <rect x="6" y="2" width="12" height="20" rx="2" />
      <path d="M10 18h4" />
    </Base>
  );
}

export function BellIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 01-3.4 0" />
    </Base>
  );
}

export function DocumentIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M3 3v18h18M7 14l4-4 3 3 5-6" />
    </Base>
  );
}

export function HelpIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 015 0c0 1.7-2.5 2-2.5 3.5" />
      <circle cx="12" cy="16.5" r="0.6" fill="currentColor" stroke="none" />
    </Base>
  );
}

export function WalletIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <rect x="3" y="6" width="18" height="14" rx="2" />
      <path d="M3 10h18" />
      <circle cx="16" cy="14.5" r="1.2" fill="currentColor" stroke="none" />
    </Base>
  );
}

export function NotebookIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 3v18M13 8h6M13 12h6M13 16h4" />
    </Base>
  );
}

export function PackageIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M21 8l-9-5-9 5 9 5 9-5z" />
      <path d="M3 8v8l9 5 9-5V8M12 13v8" />
    </Base>
  );
}

export function ConstructionIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M3 21h18M6 21V10l6-5 6 5v11" />
      <path d="M9 21v-5h6v5" />
    </Base>
  );
}

export function TrendingUpIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M3 17l6-6 4 4 8-8M21 7v6h-6" />
    </Base>
  );
}

export function TrendingDownIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M3 7l6 6 4-4 8 8M21 17v-6h-6" />
    </Base>
  );
}

export function HourglassIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M6 2h12M6 22h12M7 2c0 5 3 7 5 8-2 1-5 3-5 8M17 2c0 5-3 7-5 8 2 1 5 3 5 8" />
    </Base>
  );
}

export function NewspaperIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <rect x="3" y="5" width="14" height="15" rx="1.5" />
      <path d="M7 9h6M7 12.5h6M7 16h4" />
      <path d="M17 8h2a2 2 0 012 2v8a2 2 0 01-2 2H8" />
    </Base>
  );
}

export function CalculatorIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <path d="M8 6h8M7.5 11h1.5M11.25 11h1.5M15 11h1.5M7.5 15h1.5M11.25 15h1.5M15 15v4M7.5 19h5" />
    </Base>
  );
}

export function SearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M20 20l-5-5" />
    </Base>
  );
}

export function BankIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M3 21h18M4 21V10M20 21V10M2 10l10-6 10 6M7 10v11M12 10v11M17 10v11" />
    </Base>
  );
}

export function ShoppingBagIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M6 8h12l1 12a2 2 0 01-2 2H7a2 2 0 01-2-2L6 8z" />
      <path d="M9 8V6a3 3 0 016 0v2" />
    </Base>
  );
}

export function UtensilsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M6 2v8M4 2v6a2 2 0 002 2 2 2 0 002-2V2M6 12v10M18 2c-2 0-3 2.5-3 6s1 5 3 5 3-1.5 3-5-1-6-3-6zM18 13v9" />
    </Base>
  );
}

export function CarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M3 16V13l2-5a2 2 0 012-1h10a2 2 0 012 1l2 5v3" />
      <path d="M3 16h18M6 16v3M18 16v3" />
      <circle cx="7.5" cy="16" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="16.5" cy="16" r="1.4" fill="currentColor" stroke="none" />
    </Base>
  );
}

export function ClapperboardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M3 9l1.5-4.5L20 8 18.5 12.5z" />
      <rect x="3" y="9" width="18" height="12" rx="1.5" />
      <path d="M7 5l3 4M13 4l3 4" />
    </Base>
  );
}

export function HouseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10" />
    </Base>
  );
}

export function PillIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <rect x="4" y="9" width="16" height="8" rx="4" transform="rotate(-35 12 13)" />
      <path d="M9 13l6-6" />
    </Base>
  );
}

export function BookIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M4 4.5A2.5 2.5 0 016.5 2H20v17H6.5A2.5 2.5 0 004 21.5v-17z" />
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
    </Base>
  );
}

export function ChatBubbleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M21 11.5a8.5 8.5 0 01-8.9 8.5 8.7 8.7 0 01-3.6-.8L3 21l1.9-5a8.4 8.4 0 01-.9-3.8 8.5 8.5 0 018.5-8.4c4.7 0 8.5 3.7 8.5 8.5z" />
    </Base>
  );
}

export function CoinsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <ellipse cx="9" cy="7" rx="6" ry="3" />
      <path d="M3 7v5c0 1.66 2.69 3 6 3s6-1.34 6-3V7" />
      <path d="M9 12v5c0 1.66 2.69 3 6 3s6-1.34 6-3v-5" />
      <ellipse cx="15" cy="12" rx="6" ry="3" />
    </Base>
  );
}

export function RefreshIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M3 12a9 9 0 0115.3-6.4L21 8M21 3v5h-5" />
      <path d="M21 12a9 9 0 01-15.3 6.4L3 16M3 21v-5h5" />
    </Base>
  );
}

export function CameraIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M4 8h3l2-3h6l2 3h3a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z" />
      <circle cx="12" cy="14" r="3.5" />
    </Base>
  );
}

export function GearIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.6 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
    </Base>
  );
}

export function BarChartIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M4 20V10M10 20V4M16 20v-7M20 20H4" />
    </Base>
  );
}

export function SatelliteOffIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M3 3l18 18" />
      <path d="M9 9a4 4 0 004.8 4.8M13 7a6 6 0 013 3M16.5 3.5a10 10 0 013.9 6.6" />
      <path d="M5.5 13.8a10 10 0 002.7 4M2 17.5l3-3" />
      <circle cx="17" cy="17" r="2" />
    </Base>
  );
}

export function PinIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M12 21s7-6.5 7-11.5A7 7 0 105 9.5C5 14.5 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.2" />
    </Base>
  );
}

export function NoteIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M20 20h-9a4 4 0 01-4-4V4h9l4 4v12z" />
      <path d="M16 4v4h4" />
    </Base>
  );
}

export function TrashIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13a2 2 0 002 2h6a2 2 0 002-2l1-13" />
    </Base>
  );
}

export function SignOutIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
    </Base>
  );
}

export function PlusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M12 5v14M5 12h14" />
    </Base>
  );
}

export function HistoryIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M3 3v6h6M3 9a9 9 0 1010-8.5" />
      <path d="M12 7v5l4 2" />
    </Base>
  );
}

export function RepeatIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M17 2.1l4 4-4 4M3 12v-2a4 4 0 014-4h14M7 21.9l-4-4 4-4M21 12v2a4 4 0 01-4 4H3" />
    </Base>
  );
}

export function TransferIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M7 3v14M3 13l4 4 4-4M17 21V7M13 11l4-4 4 4" />
    </Base>
  );
}

export function PencilIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M17 3a2.85 2.85 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </Base>
  );
}

export function UploadIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M12 16V4M7 9l5-5 5 5M4 16v3a2 2 0 002 2h12a2 2 0 002-2v-3" />
    </Base>
  );
}
