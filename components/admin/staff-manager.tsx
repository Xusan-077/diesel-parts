"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import axios, { type Method } from "axios";
import { toast } from "sonner";
import { requestErrorMessage } from "@/lib/api/request-error";
import { Button } from "@/components/ui/button";
import { CheckboxField } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export interface StaffView {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: "DIRECTOR" | "SELLER";
  isActive: boolean;
  discountLimit: number;
  completedOrders: number;
  createdAt: string;
}

const ROLE_LABEL: Record<StaffView["role"], string> = {
  DIRECTOR: "Direktor",
  SELLER: "Sotuvchi",
};

/** Resolves to the message to print, or to null when the write went through. */
async function send(url: string, method: Method, body: unknown): Promise<string | null> {
  try {
    await axios.request({ url, method, data: body });
    return null;
  } catch (error) {
    return requestErrorMessage(error, "Saqlanmadi. Maydonlarni tekshiring.");
  }
}

function EditRow({ user, onDone }: { user: StaffView; onDone: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: user.name,
    phone: user.phone ?? "",
    role: user.role,
    discountLimit: user.discountLimit,
    isActive: user.isActive,
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const message = await send("/api/v1/users/" + user.id, "PATCH", {
      ...form,
      phone: form.phone.trim() || null,
    });
    setBusy(false);

    if (message) {
      setError(message);
      toast.error(message);
      return;
    }
    toast.success("Xodim ma'lumotlari saqlandi");
    onDone();
    router.refresh();
  }

  return (
    <tr className="border-b border-border bg-surface-muted">
      <td colSpan={6} className="px-3 py-4">
        <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
          <FormField label="Ismi">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </FormField>
          <FormField label="Telefon">
            <Input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="font-mono"
              placeholder="+998 90 000 00 00"
            />
          </FormField>
          <FormField label="Rol">
            <Select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as StaffView["role"] })}
            >
              <option value="SELLER">Sotuvchi</option>
              <option value="DIRECTOR">Direktor</option>
            </Select>
          </FormField>
          <FormField
            label="Chegirma limiti (%)"
            hint="Shu foizdan yuqorisi direktor tasdig'ini talab qiladi"
          >
            <Input
              inputMode="numeric"
              value={String(form.discountLimit)}
              onChange={(e) => setForm({ ...form, discountLimit: Number(e.target.value) || 0 })}
              className="font-mono tabular-nums"
            />
          </FormField>
        </div>

        <CheckboxField
          label="Hisob faol"
          hint="Belgi olib tashlansa hisob darhol kira olmaydi — ochiq sessiya ham to'xtaydi."
          checked={form.isActive}
          onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          fieldClassName="mt-4"
        />

        <div aria-live="polite" className="min-h-5">
          {error ? (
            <p role="alert" className="mt-3 text-sm text-danger">
              {error}
            </p>
          ) : null}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Button type="button" size="sm" onClick={save} disabled={busy}>
            {busy ? "Saqlanmoqda…" : "Saqlash"}
          </Button>
          <button
            type="button"
            onClick={onDone}
            className="text-xs text-muted transition-colors hover:text-foreground"
          >
            Bekor qilish
          </button>
        </div>
      </td>
    </tr>
  );
}

function CreateForm({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "SELLER" as StaffView["role"],
    discountLimit: 5,
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const message = await send("/api/v1/users", "POST", {
      ...form,
      phone: form.phone.trim() || null,
    });
    setBusy(false);

    if (message) {
      setError(message);
      toast.error(message);
      return;
    }
    toast.success("Xodim qo'shildi");
    onDone();
    router.refresh();
  }

  return (
    /* `panel` rather than a hand-copied border+radius+padding: the container
       recipe lives in one place, so a card here and a card on the dashboard
       cannot end up 20px and 24px deep. */
    <form onSubmit={create} className="panel mt-4 max-w-3xl" noValidate>
      <h2 className="type-title text-foreground">Yangi xodim</h2>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <FormField label="Ismi">
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </FormField>
        <FormField label="Email">
          <Input
            type="email"
            autoComplete="off"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </FormField>
        <FormField label="Telefon">
          <Input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="font-mono"
            placeholder="+998 90 000 00 00"
          />
        </FormField>
        <FormField label="Boshlang'ich parol" hint="Kamida 8 belgi. Xodimga o'zingiz yetkazasiz.">
          <Input
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
        </FormField>
        <FormField label="Rol">
          <Select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as StaffView["role"] })}
          >
            <option value="SELLER">Sotuvchi</option>
            <option value="DIRECTOR">Direktor</option>
          </Select>
        </FormField>
        <FormField
          label="Chegirma limiti (%)"
          hint="Shu foizdan yuqorisi direktor tasdig'ini talab qiladi"
        >
          <Input
            inputMode="numeric"
            value={String(form.discountLimit)}
            onChange={(e) => setForm({ ...form, discountLimit: Number(e.target.value) || 0 })}
            className="font-mono tabular-nums"
          />
        </FormField>
      </div>

      <div aria-live="polite" className="min-h-5">
        {error ? (
          <p role="alert" className="mt-4 text-sm text-danger">
            {error}
          </p>
        ) : null}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "Qo'shilmoqda…" : "Xodim qo'shish"}
        </Button>
        <button
          type="button"
          onClick={onDone}
          className="text-xs text-muted transition-colors hover:text-foreground"
        >
          Bekor qilish
        </button>
      </div>
    </form>
  );
}

export function StaffManager({ users }: { users: StaffView[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted">{users.length} ta hisob</p>
        {!creating ? (
          <Button type="button" size="sm" onClick={() => setCreating(true)}>
            Xodim qo&apos;shish
          </Button>
        ) : null}
      </div>

      {creating ? <CreateForm onDone={() => setCreating(false)} /> : null}

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
            {users.map((user) =>
              editing === user.id ? (
                <EditRow key={user.id} user={user} onDone={() => setEditing(null)} />
              ) : (
                <tr key={user.id} className="border-b border-border last:border-0">
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
                    {user.isActive ? (
                      <span className="text-xs text-muted">faol</span>
                    ) : (
                      <span className="rounded-full bg-surface-muted px-2 py-1 text-xs text-muted">
                        o&apos;chirilgan
                      </span>
                    )}
                  </td>
                  <td className="py-3 pl-3 text-right">
                    <button
                      type="button"
                      onClick={() => setEditing(user.id)}
                      className="text-xs text-muted underline-offset-4 transition-colors hover:text-foreground hover:underline"
                    >
                      Tahrirlash
                    </button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
