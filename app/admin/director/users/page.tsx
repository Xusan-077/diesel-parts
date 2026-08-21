import { listStaff } from "@/lib/api/user-repository";
import { PageHeader } from "@/components/admin/page-header";
import { StaffManager } from "@/components/admin/staff-manager";

export default async function DirectorUsersPage() {
  const users = await listStaff();

  return (
    <div>
      <PageHeader
        eyebrow="Direktor paneli"
        title="Xodimlar"
        description="Sotuvchi hisoblari, ularning chegirma limitlari va kirish huquqi."
      />

      <div className="mt-8">
        <StaffManager
          users={users.map((user) => ({ ...user, createdAt: user.createdAt.toISOString() }))}
        />
      </div>
    </div>
  );
}
