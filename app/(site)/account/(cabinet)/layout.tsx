import { redirect } from "next/navigation";
import { AccountCabinet } from "@/components/account/account-cabinet";
import { formatPhone } from "@/lib/auth/phone";
import { getSession } from "@/lib/auth/session";
import { getLocaleDictionary } from "@/lib/i18n/server-locale";
import { Container } from "@/components/ui/container";

/**
 * The cabinet's frame, shared by every section under /account.
 *
 * It is in a `(cabinet)` route group rather than at `app/(site)/account/`
 * because of the sign-in guard below: /account/verify is the screen a visitor
 * sees *before* they have a session, and a guard on the whole segment would
 * bounce them off the page that is supposed to give them one. The group is
 * invisible in the URL, so the routes it holds are still /account,
 * /account/wishlist and the rest.
 *
 * The heading lives here and not in the pages: it names the cabinet, not the
 * section, and repeating it six times is how the six drift apart.
 */
export default async function AccountCabinetLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const dict = await getLocaleDictionary();

  const session = await getSession();
  if (!session) {
    // Signing in is a dialog on the header now, not a page of its own.
    redirect("/");
  }

  return (
    <Container as="div" size="wide" className="pb-24 pt-10">
      <h1 className="type-page text-foreground">{dict.account.profileTitle}</h1>
      <p className="mt-2 type-body text-muted">{dict.account.profileSubtitle}</p>

      <div className="mt-8">
        <AccountCabinet dict={dict.account} phone={formatPhone(session.phone)}>
          {children}
        </AccountCabinet>
      </div>
    </Container>
  );
}
