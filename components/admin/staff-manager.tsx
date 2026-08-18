"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

const FIELD = "border-l-2 border-border pl-4 transition-colors focus-within:border-accent-strong";

async function send(url: string, method: string, body: unknown): Promise<string | null> {
  try {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json()) as {
      success: boolean;
      errors?: Record<string, string[] | undefined>;
    };
    if (data.success) {
      return null;
    }
    return data.errors?._root?.[0] ?? "Saqlanmadi. Maydonlarni tekshiring.";
  } catch {
    return "Ulanmadi. Qayta urinib ko'ring.";
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
      return;
    }
    onDone();
    router.refresh();
  }

  return (
    <tr className="border-b border-border bg-surface-muted">
      <td colSpan={6} className="px-3 py-5">
        <div className="grid max-w-3xl gap-5 sm:grid-cols-2">
          <div className={FIELD}>
            <Label htmlFor={"name-" + user.id}>Ismi</Label>
            <Input
              id={"name-" + user.id}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1.5 border-0 px-0 focus:border-0"
            />
          </div>
          <div className={FIELD}>
            <Label htmlFor={"phone-" + user.id}>Telefon</Label>
            <Input
              id={"phone-" + user.id}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="mt-1.5 border-0 px-0 font-mono focus:border-0"
              placeholder="+998 90 000 00 00"
            />
          </div>
          <div className={FIELD}>
            <Label htmlFor={"role-" + user.id}>Rol</Label>
            <select
              id={"role-" + user.id}
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as StaffView["role"] })}
              className="mt-1.5 h-10 w-full bg-transparent text-sm text-foreground"
            >
              <option value="SELLER">Sotuvchi</option>
              <option value="DIRECTOR">Direktor</option>
            </select>
          </div>
          <div className={FIELD}>
            <Label htmlFor={"limit-" + user.id}>Chegirma limiti (%)</Label>
            <Input
              id={"limit-" + user.id}
              inputMode="numeric"
              value={String(form.discountLimit)}
              onChange={(e) => setForm({ ...form, discountLimit: Number(e.target.value) || 0 })}
              className="mt-1.5 border-0 px-0 font-mono tabular-nums focus:border-0"
            />
            <p className="mt-1 text-xs text-muted">
              Shu foizdan yuqorisi direktor tasdig&apos;ini talab qiladi
            </p>
          </div>
        </div>

        <label className="mt-5 flex items-center gap-3 text-sm text-foreground">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          Hisob faol
        </label>
        <p className="mt-1 text-xs text-muted">
          Belgi olib tashlansa hisob darhol kira olmaydi — ochiq sessiya ham to&apos;xtaydi.
        </p>

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
      return;
    }
    onDone();
    router.refresh();
  }

  return (
    <form onSubmit={create} className="mt-6 max-w-3xl rounded-lg border border-border p-6" noValidate>
      <h2 className="font-mono text-[0.6875rem] uppercase tracking-[0.15em] text-muted">
        Yangi xodim
      </h2>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div className={FIELD}>
          <Label htmlFor="new-name">Ismi</Label>
          <Input
            id="new-name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="mt-1.5 border-0 px-0 focus:border-0"
            required
          />
        </div>
        <div className={FIELD}>
          <Label htmlFor="new-email">Email</Label>
          <Input
            id="new-email"
            type="email"
            autoComplete="off"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="mt-1.5 border-0 px-0 focus:border-0"
            required
          />
        </div>
        <div className={FIELD}>
          <Label htmlFor="new-phone">Telefon</Label>
          <Input
            id="new-phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="mt-1.5 border-0 px-0 font-mono focus:border-0"
          />
        </div>
        <div className={FIELD}>
          <Label htmlFor="new-password">Boshlang&apos;ich parol</Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="mt-1.5 border-0 px-0 focus:border-0"
            required
          />
          <p className="mt-1 text-xs text-muted">
            Kamida 8 belgi. Xodimga o&apos;zingiz yetkazasiz.
          </p>
        </div>
        <div className={FIELD}>
          <Label htmlFor="new-role">Rol</Label>
          <select
            id="new-role"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as StaffView["role"] })}
            className="mt-1.5 h-10 w-full bg-transparent text-sm text-foreground"
          >
            <option value="SELLER">Sotuvchi</option>
            <option value="DIRECTOR">Direktor</option>
          </select>
        </div>
        <div className={FIELD}>
          <Label htmlFor="new-limit">Chegirma limiti (%)</Label>
          <Input
            id="new-limit"
            inputMode="numeric"
            value={String(form.discountLimit)}
            onChange={(e) => setForm({ ...form, discountLimit: Number(e.target.value) || 0 })}
            className="mt-1.5 border-0 px-0 font-mono tabular-nums focus:border-0"
          />
        </div>
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

      <div className="mt-8 overflow-x-auto">
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
                  <td className="py-2.5 pr-3">
                    <span className="text-foreground">{user.name}</span>
                    <span className="ml-2 font-mono text-xs text-muted">{user.email}</span>
                  </td>
                  <td className="py-2.5 pr-3 text-muted">{ROLE_LABEL[user.role]}</td>
                  <td className="py-2.5 text-right font-mono tabular-nums text-foreground">
                    {user.discountLimit}%
                  </td>
                  <td className="py-2.5 pl-3 text-right font-mono tabular-nums text-muted">
                    {user.completedOrders}
                  </td>
                  <td className="py-2.5 pl-3 text-right">
                    {user.isActive ? (
                      <span className="text-xs text-muted">faol</span>
                    ) : (
                      <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-muted">
                        o&apos;chirilgan
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 pl-3 text-right">
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
