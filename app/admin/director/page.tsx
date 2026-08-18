import { requireDirector } from "@/lib/auth/dal";
import { PanelHeader } from "@/components/admin/panel-header";

export default async function DirectorHomePage() {
  const user = await requireDirector();

  return (
    <div className="min-h-dvh bg-background">
      <PanelHeader user={user} area="Direktor paneli" />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Direktor paneli</h1>
        <p className="mt-2 max-w-prose text-sm text-muted">
          Savdo ko&apos;rsatkichlari, mahsulot boshqaruvi, sotuvchilar va chegirma
          so&apos;rovlari shu yerda bo&apos;ladi.
        </p>
      </main>
    </div>
  );
}
