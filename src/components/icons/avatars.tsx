import { SVGProps } from "react";

function Base(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    />
  );
}

export interface AvatarOption {
  id: string;
  label: string;
  Icon: (props: SVGProps<SVGSVGElement>) => React.JSX.Element;
}

export function PersonAvatarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <circle cx="20" cy="14" r="6" />
      <path d="M9 32c0-7 5-11 11-11s11 4 11 11" />
    </Base>
  );
}

export function SparkleAvatarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M20 6l4 8 8 1-6 6 1.5 9L20 26l-7.5 4L14 21 8 15l8-1z" />
    </Base>
  );
}

export function SunAvatarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <circle cx="20" cy="20" r="7" />
      <path d="M20 4v4M20 32v4M4 20h4M32 20h4M9 9l3 3M28 28l3 3M31 9l-3 3M12 28l-3 3" />
    </Base>
  );
}

export function MountainAvatarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M8 26c4-10 8-16 12-16s8 6 12 16" />
      <path d="M8 26h24" />
    </Base>
  );
}

export function LeafAvatarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M20 8c6 0 10 5 10 11s-4 11-10 11S10 25 10 19 14 8 20 8z" />
      <path d="M20 8v22" />
    </Base>
  );
}

export function FlowerAvatarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M20 30c-8-4-12-10-12-16a12 12 0 0124 0c0 6-4 12-12 16z" />
      <circle cx="20" cy="15" r="3" />
    </Base>
  );
}

export function MoonAvatarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M25 8a12 12 0 100 24 10 10 0 010-24z" />
    </Base>
  );
}

export function StarAvatarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M20 6l3.5 9 9.5.5-7.5 6 2.5 9.5-8-5.5-8 5.5 2.5-9.5-7.5-6 9.5-.5z" />
    </Base>
  );
}

export function FlameAvatarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M20 6c2 6-3 8-1 13 1.5-2 3-2 3-2 1 4-1 8-6 9-6-1-9-6-8-11 1-4 4-6 4-6s-2 0-3 2c0-3 3-6 11-5z" />
    </Base>
  );
}

export const AVATAR_OPTIONS: AvatarOption[] = [
  { id: "person", label: "Людина", Icon: PersonAvatarIcon },
  { id: "sparkle", label: "Іскра", Icon: SparkleAvatarIcon },
  { id: "sun", label: "Сонце", Icon: SunAvatarIcon },
  { id: "mountain", label: "Гори", Icon: MountainAvatarIcon },
  { id: "leaf", label: "Листя", Icon: LeafAvatarIcon },
  { id: "flower", label: "Квітка", Icon: FlowerAvatarIcon },
  { id: "moon", label: "Місяць", Icon: MoonAvatarIcon },
  { id: "star", label: "Зірка", Icon: StarAvatarIcon },
  { id: "flame", label: "Вогонь", Icon: FlameAvatarIcon },
];

export function getAvatarIcon(id: string) {
  return AVATAR_OPTIONS.find((a) => a.id === id)?.Icon ?? PersonAvatarIcon;
}
