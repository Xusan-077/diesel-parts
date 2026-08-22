"use client";

import { ProfilePanel } from "./profile-panel";
import { useProfile } from "@/hooks/use-store";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * The details section, wired to the browser-side profile.
 *
 * The cabinet used to hand `ProfilePanel` its profile and its save function,
 * because the cabinet was the only client component on the screen. Now that
 * each section is a route, the details page is a Server Component and cannot
 * reach the store — so the subscription happens here, one step above the
 * panel. `useProfile` is a store hook and the rail holds a second subscription
 * to the same state, which is what keeps the head's name in step with a save
 * made in the card below it.
 */
export function AccountDetails({
  dict,
  phone,
}: {
  dict: Dictionary["account"];
  /** Display form of the session's number, e.g. "+998 90 123-45-67". */
  phone: string;
}) {
  const { profile, save } = useProfile();

  return <ProfilePanel dict={dict} profile={profile} phone={phone} onSave={save} />;
}
