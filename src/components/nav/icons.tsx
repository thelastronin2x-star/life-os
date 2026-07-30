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

export function HomeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10" />
    </Base>
  );
}

export function CalendarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </Base>
  );
}

export function BalanceIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M12 22c5-4 8-7.5 8-12a8 8 0 10-16 0c0 4.5 3 8 8 12z" />
    </Base>
  );
}

export function AssistantIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M21 11.5a8.5 8.5 0 01-8.9 8.5 8.7 8.7 0 01-3.6-.8L3 21l1.9-5a8.4 8.4 0 01-.9-3.8 8.5 8.5 0 018.5-8.4c4.7 0 8.5 3.7 8.5 8.5z" />
    </Base>
  );
}

export function ProfileIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </Base>
  );
}

export function WorkIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M3 17l6-6 4 4 8-8M21 7v6h-6" />
    </Base>
  );
}
