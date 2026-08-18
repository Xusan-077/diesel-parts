import { requireStaff } from "@/lib/auth/dal";
import { PanelHeader } from "@/components/admin/panel-header";

export default async function SellerHomePage() {
  const user = await requireStaff();

  return (
    <div className="min-h-dvh bg-background">
      <PanelHeader user={user} area="Sotuvchi paneli" />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Sotuvchi paneli</h1>
        <p className="mt-2 max-w-prose text-sm text-muted">
          So&apos;rovlar taxtasi, mijozlar bazasi, buyurtmalar va zaxira tekshiruvi shu
          yerda bo&apos;ladi.
        </p>
      </main>
    </div>
  );
}
