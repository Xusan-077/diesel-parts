"use client";

import { useState } from "react";
import { Pencil, ShieldCheck, Trash2 } from "lucide-react";
import { AccountDeleteModal } from "./account-delete-modal";
import { AccountPhoneModal } from "./account-phone-modal";
import { ProfileDetailsModal } from "./profile-details-modal";
import { formatBirthDate, profileInitials, type Profile } from "@/lib/account/profile";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

/** A card's own edit affordance: same control on all three cards. */
function EditButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 type-label text-accent-strong transition-colors hover:bg-surface-hover"
    >
      <Icon icon={Pencil} size="xs" />
      {label}
    </button>
  );
}

function CardShell({
  title,
  action,
  children,
  className,
}: {
  title: string;
  /** Omitted on a card with nothing to change — the header keeps its height. */
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-lg border border-border bg-surface", className)}>
      <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
        <h2 className="type-title text-foreground">{title}</h2>
        {action ?? null}
      </div>
      <div className="px-6 py-5">{children}</div>
    </section>
  );
}

/** One label-over-value pair. Never collapses: an empty field says so. */
function DetailItem({ label, value, empty }: { label: string; value: string; empty: string }) {
  const filled = value.length > 0;
  return (
    <div>
      <dt className="type-caption text-muted">{label}</dt>
      <dd className={cn("mt-1 type-body", filled ? "text-foreground" : "text-muted")}>
        {filled ? value : empty}
      </dd>
    </div>
  );
}

export function ProfilePanel({
  dict,
  profile,
  phone,
  onSave,
}: {
  dict: Dictionary["account"];
  profile: Profile;
  /** Already formatted for display. */
  phone: string;
  onSave: (profile: Profile) => void;
}) {
  const panel = dict.profilePanel;
  const [editing, setEditing] = useState<"details" | "phone" | "delete" | null>(null);

  const genderText =
    profile.gender === "male"
      ? panel.genderMale
      : profile.gender === "female"
        ? panel.genderFemale
        : "";

  return (
    <div className="flex flex-col gap-6">
      <CardShell
        title={panel.detailsTitle}
        action={<EditButton label={panel.edit} onClick={() => setEditing("details")} />}
      >
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <span
            aria-hidden
            className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-2xl font-semibold text-accent-strong"
          >
            {profileInitials(profile, phone)}
          </span>

          <dl className="grid flex-1 gap-x-8 gap-y-5 sm:grid-cols-2">
            <DetailItem label={panel.firstName} value={profile.firstName} empty={panel.notFilled} />
            <DetailItem label={panel.lastName} value={profile.lastName} empty={panel.notFilled} />
            <DetailItem
              label={panel.birthDate}
              value={formatBirthDate(profile.birthDate)}
              empty={panel.notFilled}
            />
            <DetailItem label={panel.gender} value={genderText} empty={panel.genderUnset} />
          </dl>
        </div>
      </CardShell>

      <CardShell
        title={panel.phoneTitle}
        action={<EditButton label={panel.edit} onClick={() => setEditing("phone")} />}
      >
        <p className="type-body tabular-nums text-foreground">{phone}</p>
      </CardShell>

      {/*
        No password row, because there is no password: the site verifies a
        one-time code against the number above on every sign-in and stores no
        secret for this visitor. A masked field here would be a picture of a
        credential that does not exist, and an "update password" control would
        lead nowhere.
      */}
      <CardShell title={panel.securityTitle}>
        <div className="flex gap-3">
          <Icon icon={ShieldCheck} size="md" className="mt-0.5 shrink-0 text-success" />
          <dl>
            <dt className="type-caption text-muted">{panel.signInMethod}</dt>
            <dd className="mt-1 type-body text-foreground">{panel.signInBySms}</dd>
            <dd className="mt-2 type-caption text-muted">{panel.securityHint}</dd>
          </dl>
        </div>
      </CardShell>

      <div className="border-t border-border pt-6">
        <button
          type="button"
          onClick={() => setEditing("delete")}
          className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 type-label text-danger transition-colors hover:border-danger hover:bg-danger-surface"
        >
          <Icon icon={Trash2} />
          {panel.deleteTitle}
        </button>
        <p className="mt-2 type-caption text-muted">{panel.deleteSubtitle}</p>
      </div>

      <ProfileDetailsModal
        panel={panel}
        open={editing === "details"}
        onOpenChange={(open) => setEditing(open ? "details" : null)}
        profile={profile}
        onSave={onSave}
      />
      <AccountPhoneModal
        dict={dict}
        open={editing === "phone"}
        onOpenChange={(open) => setEditing(open ? "phone" : null)}
      />
      <AccountDeleteModal
        panel={panel}
        open={editing === "delete"}
        onOpenChange={(open) => setEditing(open ? "delete" : null)}
      />
    </div>
  );
}
