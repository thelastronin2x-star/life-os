import { Card } from "@/components/ui/Card";

export function PlaceholderScreen({
  title,
  subtitle,
  emoji,
  note,
}: {
  title: string;
  subtitle: string;
  emoji: string;
  note: string;
}) {
  return (
    <div>
      <div className="pb-4 pt-2">
        <div className="font-heading text-lg font-semibold text-text">{title}</div>
        <div className="mt-0.5 text-[11.5px] text-text-faint">{subtitle}</div>
      </div>
      <Card className="py-10 text-center">
        <div className="mb-2 text-3xl">{emoji}</div>
        <div className="text-[13px] font-semibold text-text">Скоро тут</div>
        <div className="mt-1 text-[11.5px] text-text-faint">{note}</div>
      </Card>
    </div>
  );
}
