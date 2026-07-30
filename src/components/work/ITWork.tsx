import { Card } from "@/components/ui/Card";
import { ConstructionIcon } from "@/components/icons";

export function ITWork() {
  return (
    <Card className="py-8 text-center">
      <ConstructionIcon className="mx-auto mb-2 h-8 w-8 text-text-faint" />
      <div className="mb-1 text-[13px] font-semibold text-text">IT-профіль ще в розробці</div>
      <div className="text-[11.5px] leading-relaxed text-text-faint">
        Дошка задач, спринти й фокус-час з&apos;являться тут пізніше — зараз застосунок
        зосереджений на профілі Трейдера.
      </div>
    </Card>
  );
}
