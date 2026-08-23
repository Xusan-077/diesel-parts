import type { Metadata } from "next";
import { WishlistClient } from "@/components/store/wishlist-client";
import { AccountPanelCard } from "@/components/account/account-section";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server-locale";

export async function generateMetadata(): Promise<Metadata> {
  const dict = getDictionary(await getLocale());
  return {
    title: `${dict.account.profilePanel.nav.wishlist} — ${dict.meta.siteName}`,
    robots: { index: false, follow: false },
  };
}

/**
 * Saved products, inside the cabinet.
 *
 * The same `WishlistClient` the standalone /wishlist page renders, reading the
 * same store — this is not a second copy of the list, it is the list, shown in
 * the frame a signed-in visitor is already in. The two routes exist for two
 * different arrivals: the heart in the header goes to /wishlist, the menu row
 * in the cabinet stays in the cabinet.
 */
export default async function AccountWishlistPage() {
  const lang = await getLocale();
  const dict = getDictionary(lang);

  return (
    <AccountPanelCard title={dict.account.profilePanel.nav.wishlist}>
      <div className="px-6 py-6">
        <WishlistClient
          lang={lang}
          dict={dict.wishlist}
          cartDict={dict.productActions}
          requestPriceLabel={dict.common.requestPrice}
          stock={dict.common.stock}
        />
      </div>
    </AccountPanelCard>
  );
}
