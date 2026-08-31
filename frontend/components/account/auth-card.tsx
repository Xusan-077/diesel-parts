import type { ReactNode } from "react";
import { Container } from "@/components/ui/container";

export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <Container as="main" className="max-w-md py-20">
      <div className="rounded-lg border border-border bg-surface p-8">
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{subtitle}</p>
        <div className="mt-8">{children}</div>
      </div>
    </Container>
  );
}
