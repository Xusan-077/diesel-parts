import { SellerAuthGate } from "@/components/seller/seller-auth-gate";
import { Sidebar } from "@/components/seller/sidebar";
import { Header } from "@/components/seller/header";

/**
 * The authenticated shell: the sidebar, the header, and the client-side auth
 * gate that gets a visitor here in the first place. Split out from the root
 * layout (app/seller/layout.tsx) so `/seller/login`, a sibling of this route
 * group, never mounts underneath it — see that file's note.
 */
export default function SellerPanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <SellerAuthGate>
      <div className="flex min-h-dvh">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
        </div>
      </div>
    </SellerAuthGate>
  );
}
