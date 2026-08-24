import { listStaff } from "@/lib/api/user-repository";
import { safeRead } from "@/lib/api/safe-read";
import { PageHeader } from "@/components/admin/page-header";
import { StaffManager } from "@/components/admin/staff-manager";

export default async function DirectorUsersPage() {
  /*
   * Seeds the list below, which owns it from there: adding a colleague or
   * suspending one invalidates that cache rather than re-running this route.
   * Serialised the way the API would send it, so the seed and a later refetch
   * are the same shape.
   */
  const users = await safeRead("admin staff list", listStaff, undefined);

  return (
    <div>
      <PageHeader
        eyebrow="Direktor paneli"
        title="Xodimlar"
        description="Sotuvchi hisoblari, ularning chegirma limitlari va kirish huquqi."
      />

      <div className="mt-8">
        <StaffManager
          initialData={users.data?.map((user) => ({
            ...user,
            createdAt: user.createdAt.toISOString(),
          }))}
        />
      </div>
    </div>
  );
}
