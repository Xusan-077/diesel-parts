import { ChevronDown } from "lucide-react";
import { Icon } from "@/components/ui/icon";

export interface FaqItem {
  question: string;
  answer: string;
}

export function FaqList({ items }: { items: readonly FaqItem[] }) {
  return (
    <div className="divide-y divide-border rounded-lg border border-border">
      {items.map((item) => (
        <details key={item.question} className="group px-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
            {item.question}
            <Icon
              icon={ChevronDown}
              className="text-muted transition-transform group-open:rotate-180"
            />
          </summary>
          <p className="pb-4 text-sm leading-relaxed text-muted">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}
