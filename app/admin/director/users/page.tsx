import { listStaff } from "@/lib/api/user-repository";
import { StaffManager } from "@/components/admin/staff-manager";

export default async function DirectorUsersPage() {
  const users = await listStaff();

  return (
    <div>
      <p className="font-mono text-[0.6875rem] uppercase tracking-[0.2em] text-muted">
        Direktor paneli
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
        Xodimlar
      </h1>
      <p className="mt-1 max-w-prose text-sm text-muted">
        Sotuvchi hisoblari, ularning chegirma limitlari va kirish huquqi.
      </p>

      <div className="mt-8">
        <StaffManager
          users={users.map((user) => ({ ...user, createdAt: user.createdAt.toISOString() }))}
        />
      </div>
    </div>
  );
}
