"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Power } from "lucide-react";
import {
  useAdminStaff,
  useCreateStaff,
  useSetStaffActive,
  useUpdateStaff,
} from "@/hooks/admin/use-admin-staff";
import type { StaffListRow } from "@/lib/api/admin/resources";
import { requestErrorMessage } from "@/lib/api/request-error";
import { useFieldErrors } from "@/lib/forms/use-field-errors";
import { userCreateSchema, userUpdateSchema } from "@/lib/schemas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckboxField } from "@/components/ui/checkbox";
import { ConfirmModal, FormModal } from "@/components/ui/form-modal";
import { FormField } from "@/components/ui/form-field";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

/**
 * One staff account as this screen sees it — which is the row the API sends,
 * not the row the repository reads: the timestamp has been through JSON.
 */
export type StaffView = StaffListRow;

// Exhaustive over StaffRole (not just the two this panel's forms can assign)
// because a row this screen displays may already carry one of the other three
// — backend/'s data model has had them since before this panel could edit
// them. Assigning SUPER_ADMIN/MANAGER/VIEWER via this UI is a separate,
// later concern (see lib/auth/roles.ts's adminHomePath comment).
const ROLE_LABEL: Record<StaffView["role"], string> = {
  SUPER_ADMIN: "Super admin",
  DIRECTOR: "Direktor",
  MANAGER: "Menejer",
  SELLER: "Sotuvchi",
  VIEWER: "Kuzatuvchi",
};

/**
 * The two fields both forms share, so the pair cannot drift apart.
 *
 * Typed against the two roles this dropdown actually offers, not the full
 * `StaffRole` — assigning SUPER_ADMIN/MANAGER/VIEWER has no UI yet (see
 * ROLE_LABEL's comment above).
 */
function RoleAndLimit({
  role,
  discountLimit,
  onRole,
  onLimit,
  onBlurLimit,
  limitError,
}: {
  role: "DIRECTOR" | "SELLER";
  discountLimit: number;
  onRole: (role: "DIRECTOR" | "SELLER") => void;
  onLimit: (limit: number) => void;
  onBlurLimit: () => void;
  limitError?: string;
}) {
  return (
    <>
      <FormField label="Rol" required>
        <Select value={role} onChange={(e) => onRole(e.target.value as "DIRECTOR" | "SELLER")}>
          <option value="SELLER">Sotuvchi</option>
          <option value="DIRECTOR">Direktor</option>
        </Select>
      </FormField>
      <FormField
        label="Chegirma limiti"
        required
        suffix="%"
        hint="Shu foizdan yuqorisi direktor tasdig'ini talab qiladi"
        error={limitError}
      >
        <Input
          inputMode="numeric"
          min={0}
          max={100}
          value={String(discountLimit)}
          onChange={(e) => onLimit(Number(e.target.value) || 0)}
          onBlur={onBlurLimit}
          className="font-mono tabular-nums"
          placeholder="5"
        />
      </FormField>
    </>
  );
}

function EditModal({
  user,
  open,
  onOpenChange,
}: {
  user: StaffView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [form, setForm] = useState({
    name: user.name,
    phone: user.phone ?? "",
    // Root's own User.role (what this route reads until Task 14 connects the
    // panel to backend/'s five-role model) only ever has these two values —
    // the edit form's role selector below only ever offers them too.
    role: user.role as "DIRECTOR" | "SELLER",
    discountLimit: user.discountLimit,
    isActive: user.isActive,
  });
  const [error, setError] = useState<string | null>(null);

  const update = useUpdateStaff();

  // An empty phone box is "no number on file", which the schema spells `null`.
  const payload = { ...form, phone: form.phone.trim() || null };
  const field = useFieldErrors(userUpdateSchema, payload);

  async function save() {
    if (!field.touchAll()) {
      return;
    }

    try {
      await update.mutateAsync({ id: user.id, values: payload });
      toast.success("Xodim ma'lumotlari saqlandi");
      onOpenChange(false);
    } catch (cause) {
      // Kept in the dialog as well as toasted: the director is still looking at
      // the form they were told to check.
      const message = requestErrorMessage(cause, "Saqlanmadi. Maydonlarni tekshiring.");
      setError(message);
      toast.error(message);
    }
  }

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="Xodimni tahrirlash"
      /* The email is the login and cannot be changed here, so it is shown as
         context rather than as a disabled field a director would try to type
         in and then wonder about. */
      description={user.email}
      submitLabel="O'zgarishlarni saqlash"
      onSubmit={save}
      busy={update.isPending}
      error={error}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Ismi" required error={field.errorFor("name")}>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            onBlur={() => field.touch("name")}
            placeholder="Alisher Karimov"
          />
        </FormField>
        <FormField label="Telefon" error={field.errorFor("phone")}>
          <Input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            onBlur={() => field.touch("phone")}
            className="font-mono"
            placeholder="+998 90 000 00 00"
          />
        </FormField>
        <RoleAndLimit
          role={form.role}
          discountLimit={form.discountLimit}
          onRole={(role) => setForm({ ...form, role })}
          onLimit={(discountLimit) => setForm({ ...form, discountLimit })}
          onBlurLimit={() => field.touch("discountLimit")}
          limitError={field.errorFor("discountLimit")}
        />
      </div>

      <CheckboxField
        label="Hisob faol"
        hint="Belgi olib tashlansa hisob darhol kira olmaydi — ochiq sessiya ham to'xtaydi."
        checked={form.isActive}
        onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
      />
    </FormModal>
  );
}

function CreateModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "SELLER" as "DIRECTOR" | "SELLER",
    discountLimit: 5,
  });
  const [error, setError] = useState<string | null>(null);

  const createUser = useCreateStaff();

  const payload = { ...form, phone: form.phone.trim() || null };
  const field = useFieldErrors(userCreateSchema, payload);

  async function create() {
    if (!field.touchAll()) {
      return;
    }

    try {
      await createUser.mutateAsync(payload);
      toast.success("Xodim qo'shildi");
      onOpenChange(false);
    } catch (cause) {
      const message = requestErrorMessage(cause, "Saqlanmadi. Maydonlarni tekshiring.");
      setError(message);
      toast.error(message);
    }
  }

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="Yangi xodim qo'shish"
      description="Hisob darhol faollashadi. Parolni xodimga o'zingiz yetkazasiz."
      submitLabel="Xodim qo'shish"
      onSubmit={create}
      busy={createUser.isPending}
      error={error}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Ismi" required error={field.errorFor("name")}>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            onBlur={() => field.touch("name")}
            placeholder="Alisher Karimov"
          />
        </FormField>
        <FormField
          label="Email"
          required
          hint="Panelga shu manzil bilan kiradi"
          error={field.errorFor("email")}
        >
          <Input
            type="email"
            autoComplete="off"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            onBlur={() => field.touch("email")}
            className="font-mono"
            placeholder="alisher@dieselparts.uz"
          />
        </FormField>
        <FormField label="Telefon" error={field.errorFor("phone")}>
          <Input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            onBlur={() => field.touch("phone")}
            className="font-mono"
            placeholder="+998 90 000 00 00"
          />
        </FormField>
        <FormField
          label="Boshlang'ich parol"
          required
          hint="Kamida 8 belgi. Xodim keyin o'zi almashtiradi."
          error={field.errorFor("password")}
        >
          <Input
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            onBlur={() => field.touch("password")}
          />
        </FormField>
        <RoleAndLimit
          role={form.role}
          discountLimit={form.discountLimit}
          onRole={(role) => setForm({ ...form, role })}
          onLimit={(discountLimit) => setForm({ ...form, discountLimit })}
          onBlurLimit={() => field.touch("discountLimit")}
          limitError={field.errorFor("discountLimit")}
        />
      </div>
    </FormModal>
  );
}

export function StaffManager({ initialData }: { initialData?: StaffView[] }) {
  const [editing, setEditing] = useState<StaffView | null>(null);
  const [creating, setCreating] = useState(false);
  const [suspending, setSuspending] = useState<StaffView | null>(null);

  const list = useAdminStaff(initialData);
  const setActive = useSetStaffActive(() => setSuspending(null));

  const suspendError = setActive.isError
    ? requestErrorMessage(setActive.error, "Saqlanmadi. Maydonlarni tekshiring.")
    : null;

  if (list.isPending) {
    return (
      <div aria-busy="true" className="panel">
        <span className="sr-only">Yuklanmoqda...</span>
        <div aria-hidden="true" className="flex flex-col gap-2">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-11 animate-pulse rounded-md bg-surface-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (list.isError) {
    return (
      <div className="panel">
        <p className="type-body text-muted">
          {requestErrorMessage(list.error, "Xodimlar ro'yxati yuklanmadi.")}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => void list.refetch()}
        >
          Qayta urinish
        </Button>
      </div>
    );
  }

  const users = list.data;

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted">{users.length} ta hisob</p>
        <Button type="button" size="sm" onClick={() => setCreating(true)}>
          Xodim qo&apos;shish
        </Button>
      </div>

      <div className="panel mt-4 overflow-x-auto">
        <table className="w-full min-w-3xl text-left text-sm">
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="pb-2 font-medium text-muted">Xodim</th>
              <th scope="col" className="pb-2 font-medium text-muted">Rol</th>
              <th scope="col" className="pb-2 text-right font-medium text-muted">Limit</th>
              <th scope="col" className="pb-2 text-right font-medium text-muted">Yopilgan</th>
              <th scope="col" className="pb-2 text-right font-medium text-muted">Holat</th>
              <th scope="col" className="pb-2 text-right font-medium text-muted">
                <span className="sr-only">Amallar</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="group row-hover border-b border-border last:border-0">
                <td className="py-3 pr-3">
                  <span className="text-foreground">{user.name}</span>
                  <span className="ml-2 font-mono text-xs text-muted">{user.email}</span>
                </td>
                <td className="py-3 pr-3 text-muted">{ROLE_LABEL[user.role]}</td>
                <td className="py-3 text-right font-mono tabular-nums text-foreground">
                  {user.discountLimit}%
                </td>
                <td className="py-3 pl-3 text-right font-mono tabular-nums text-muted">
                  {user.completedOrders}
                </td>
                <td className="py-3 pl-3 text-right">
                  {/* Two values of one field, so two badges — the same fix the
                      catalogue's status column got. Bare text beside a pill
                      reads as one status and one absence of status. */}
                  {user.isActive ? (
                    <Badge variant="success">faol</Badge>
                  ) : (
                    <Badge>o&apos;chirilgan</Badge>
                  )}
                </td>
                <td className="py-3 pl-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => setEditing(user)}
                      aria-label={"Tahrirlash: " + user.name}
                      title={"Tahrirlash: " + user.name}
                      className="flex size-8 items-center justify-center rounded-md text-muted opacity-0 transition-[opacity,color,background-color] group-hover:opacity-100 hover:bg-surface-hover hover:text-foreground focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                    >
                      <Icon icon={Pencil} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActive.reset();
                        setSuspending(user);
                      }}
                      aria-label={(user.isActive ? "O'chirish: " : "Yoqish: ") + user.name}
                      title={user.isActive ? "Hisobni o'chirish" : "Hisobni yoqish"}
                      className={
                        "flex size-8 items-center justify-center rounded-md text-muted opacity-0 transition-[opacity,color,background-color] group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 " +
                        (user.isActive
                          ? "hover:bg-danger-surface hover:text-danger"
                          : "hover:bg-surface-hover hover:text-foreground")
                      }
                    >
                      <Icon icon={Power} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {creating ? <CreateModal key="create" open onOpenChange={() => setCreating(false)} /> : null}

      {editing !== null ? (
        <EditModal key={editing.id} user={editing} open onOpenChange={() => setEditing(null)} />
      ) : null}

      <ConfirmModal
        open={suspending !== null}
        onOpenChange={() => setSuspending(null)}
        title={
          suspending?.isActive === false ? "Hisob yoqilsinmi?" : "Hisob o'chirilsinmi?"
        }
        subject={suspending === null ? "" : suspending.name + " · " + suspending.email}
        warning={
          suspending?.isActive === false
            ? "Xodim yana panelga kira oladi va unga buyurtma biriktirish mumkin bo'ladi."
            : "Xodim panelga kira olmaydi va ochiq sessiyasi darhol to'xtaydi. Yopgan savdolari va biriktirilgan mijozlari joyida qoladi."
        }
        confirmLabel={suspending?.isActive === false ? "Yoqish" : "O'chirish"}
        busy={setActive.isPending}
        error={suspendError}
        onConfirm={() => {
          if (suspending !== null) {
            setActive.mutate({ user: suspending, isActive: !suspending.isActive });
          }
        }}
      />
    </div>
  );
}
