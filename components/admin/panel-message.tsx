import type { ReactNode } from "react";

/**
 * The panel's standalone message screen — 404, the error boundary, anything
 * that has to render when the panel itself cannot.
 *
 * It deliberately does not use `PanelShell`. The sidebar prints the signed-in
 * user's name and role, and it reads them from the database, so on the one
 * failure this screen exists for — the database being unreachable — the shell
 * is precisely the thing that cannot be drawn. Same centred column as the login
 * screen, which is the panel's other page that stands on its own.
 *
 * Server-safe: no state, no `"use client"`. `not-found.tsx` stays a Server
 * Component; `error.tsx` has to be a client one and pulls this into its bundle.
 */
export function PanelMessage({
  eyebrow,
  title,
  description,
  detail,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  /** A code the reader can quote when asking for help. Optional. */
  detail?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <main className="admin-root grid min-h-dvh place-items-center bg-background px-6 py-16">
      <div className="w-full max-w-md">
        <p className="type-eyebrow text-muted">{eyebrow}</p>
        <h1 className="type-page mt-3 text-foreground">{title}</h1>
        <p className="type-body mt-2 text-muted">{description}</p>

        {detail}

        {actions ? (
          <div className="mt-8 flex flex-wrap items-center gap-3">{actions}</div>
        ) : null}
      </div>
    </main>
  );
}
