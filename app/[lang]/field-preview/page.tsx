"use client";

import { useEffect, useState } from "react";
import { CheckboxField } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

/**
 * Throwaway harness for eyeballing every field state at once. Deleted after the
 * screenshots — it is not part of the panel.
 */
function Panel({ theme }: { theme: string }) {
  const [sku, setSku] = useState("DP-INJ-3126");
  const [active, setActive] = useState(true);
  const [toggles, setToggles] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  // Only ever true on the client, so the badge below is proof of hydration
  // rather than of server rendering.
  useEffect(() => setHydrated(true), []);

  return (
    <div className="admin-root min-h-screen bg-background p-8 text-foreground">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <h1 className="type-section">{theme}</h1>
          <span
            data-testid="hydration"
            className={
              "rounded-md px-2 py-1 text-xs font-medium " +
              (hydrated
                ? "bg-success-surface text-success"
                : "bg-danger-surface text-danger")
            }
          >
            {hydrated ? "CLIENT: hydrated" : "CLIENT: not hydrated"}
          </span>
        </div>

        {/* Live readout — if these track the controls, FormField's context is
            wiring a real client component, not static HTML. */}
        <p className="type-caption text-muted">
          sku=<span className="font-mono text-foreground">{sku || "—"}</span>
          {" · "}active=<span className="font-mono text-foreground">{String(active)}</span>
          {" · "}toggles=<span className="font-mono text-foreground">{toggles}</span>
        </p>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="SKU" hint="Fokusda chiziq to'q sariq bo'ladi">
            <Input value={sku} onChange={(e) => setSku(e.target.value)} className="font-mono" />
          </FormField>

          <FormField label="Qoldiq" error="Faqat butun son kiriting">
            <Input defaultValue="12.5" className="font-mono tabular-nums" />
          </FormField>

          <FormField label="Kategoriya" hint="Native select, o'z chevroni bilan">
            <Select defaultValue="a">
              <option value="a">Yoqilg&apos;i tizimi</option>
              <option value="b">Turbina</option>
              <option value="c">Silindr kallagi</option>
            </Select>
          </FormField>

          <FormField label="Brend" error="Brend tanlanmagan">
            <Select defaultValue="">
              <option value="">—</option>
              <option value="cat">Caterpillar</option>
            </Select>
          </FormField>

          <FormField label="Slug" hint="Chop etilgandan keyin qulflanadi" disabled>
            <Input defaultValue="cat-fuel-injector-3126" className="font-mono" />
          </FormField>

          <FormField label="Tavsif" error="Tavsif bo'sh bo'lmasligi kerak">
            <Textarea rows={2} />
          </FormField>
        </div>

        <CheckboxField
          label="Katalogda ko'rinsin"
          hint="Belgi olib tashlansa mahsulot saytdan yo'qoladi."
          checked={active}
          onChange={(e) => {
            setActive(e.target.checked);
            setToggles((n) => n + 1);
          }}
        />
        <CheckboxField label="Hisob faol" error="Oxirgi direktorni o'chirib bo'lmaydi" />
        <CheckboxField label="Arxivni ko'rsatish" hint="Faqat direktor uchun" disabled />
      </div>
    </div>
  );
}

export default function FieldPreview() {
  return (
    <div className="grid lg:grid-cols-2">
      <Panel theme="LIGHT" />
      <div className="dark">
        <Panel theme="DARK" />
      </div>
    </div>
  );
}
