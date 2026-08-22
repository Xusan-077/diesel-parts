import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/layout/brand-mark";
import { LoginForm } from "@/components/admin/login-form";
import { DoorMaterialDrift } from "@/components/admin/door-material-drift";
import { Icon } from "@/components/ui/icon";
import { FloatingPaths } from "@/components/ui/background-paths";
import { ADMIN_ROOT } from "@/lib/auth/roles";

export const metadata: Metadata = {
  title: "Kirish · Boshqaruv paneli",
  robots: { index: false, follow: false },
};

/**
 * Accepts only a path inside the panel. `//evil.example` is a valid relative
 * URL to a browser and would leave the site, so the leading double slash is
 * rejected as well as anything outside /admin.
 */
function safeNext(value: string | string[] | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const isInsidePanel = value.startsWith(`${ADMIN_ROOT}/`) && !value.startsWith("//");
  return isInsidePanel ? value : null;
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { next } = await searchParams;

  return (
    /*
     * Two columns that do two different jobs.
     *
     * The left one is the console and holds everything a person touches. The
     * right one is a material — a drifting line field with the company's line
     * of type sitting in it — and holds nothing at all.
     *
     * Both are dark, in both themes. This is the first screen of a product
     * whose identity is a near-black workshop, and it used to open onto a
     * white page for anyone whose panel was set to the light theme; the door
     * now paints its own ground the way the 404 does. `.door-console` carries
     * the plate and redeclares the panel's role tokens on it, so every
     * ordinary panel class below still reads correctly. See the FRONT DOOR
     * block in app/globals.css.
     *
     * Below `lg` the material is dropped rather than stacked: on a phone it
     * would push the form under a fold and buy nothing.
     */
    <main className="admin-root door-console relative isolate grid min-h-dvh lg:grid-cols-[42fr_58fr]">
      <div className="relative flex flex-col px-6 py-8 sm:px-8 lg:px-16 lg:py-8">
        {/* The frame, not the content: it is there before the boot sequence
            runs and does not take part in it. */}
        <header className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-3">
            {/*
              The company mark, not an initials chip the panel draws for itself
              — the same `BrandMark` the storefront's header sets, so the front
              door of the panel and the front door of the site are signed by the
              same logo. The eyebrow beside it names the company in text, so the
              mark needs no accessible name of its own. Its red is repainted to
              the door's orange, and only here — see `--brand-red` in the FRONT
              DOOR block.
            */}
            <BrandMark className="h-7 text-foreground" />
            <span className="type-eyebrow text-muted">
              Diesel Parts <span aria-hidden="true">/</span> Panel
            </span>
          </span>

          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-muted transition-colors hover:text-foreground"
          >
            <Icon icon={ArrowLeft} size="sm" />
            Saytga qaytish
          </Link>
        </header>

        {/*
          The boot sequence. Badge, heading, line, then the form — each 80ms
          behind the one above it, so the console reads as coming up rather
          than as being there already. The delays are `nth-child` in CSS and
          the form continues the count through `--door-boot-offset`, so this
          markup carries the order and nothing else.
        */}
        <div className="door-boot mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-16">
          <p className="type-eyebrow flex items-center gap-2 text-muted">
            <Icon icon={ShieldCheck} size="xs" className="text-accent" />
            Xodimlar uchun
          </p>

          <h1 className="door-title mt-6 text-foreground">Xush kelibsiz!</h1>
          <p className="type-body mt-3 text-secondary">
            Hisobingiz direktor tomonidan yaratiladi.
          </p>

          <LoginForm next={safeNext(next)} />
        </div>
      </div>

      {/*
        The two sheafs lean opposite ways so the field reads as depth rather
        than as one arc repeated. Colour comes from the door's one hue through
        `currentColor`, held down to a trace by the wrapper — which is also
        what leans with the pointer.
      */}
      <aside className="door-material relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-end">
        <DoorMaterialDrift>
          <FloatingPaths position={1} />
          <FloatingPaths position={-1} />
        </DoorMaterialDrift>

        {/* A vignette at the foot of the column, so the line of type has a
            ground to sit on wherever a path happens to cross it. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-[#08090a] to-transparent" />

        <blockquote className="door-quote-block relative px-16 pb-16">
          {/* The one mark of colour on the material, and it lengthens when the
              pointer is over the quote. There is nothing to act on out here,
              so a moving rule cannot be mistaken for a control. */}
          <span aria-hidden="true" className="door-dash" />
          <p className="door-quote mt-8 max-w-lg">
            To&apos;g&apos;ri detal —
            <br />
            to&apos;xtamagan yo&apos;l.
          </p>
          <footer className="type-eyebrow mt-6 text-[var(--door-muted)]">Diesel Parts</footer>
        </blockquote>
      </aside>
    </main>
  );
}
