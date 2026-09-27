"use client";

import { Sparkles } from "lucide-react";
import type { AiEntity } from "@/lib/api/ai-repository";
import { useAiTranslate } from "@/hooks/admin/use-ai-translate";
import { requestErrorMessage } from "@/lib/api/request-error";
import { AI_LOCALES, type AiLocale, type AiSourceFields, type AiTranslateResult } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { Icon } from "@/components/ui/icon";

const LOCALE_LABEL: Record<AiLocale, string> = {
  uz: "O'zbekcha",
  ru: "Ruscha",
  en: "Inglizcha",
  zh: "Xitoycha",
};

/** A small "AI" pill next to a field label — cleared the moment the director
 *  edits that field themselves (see each form's `clearAiBadge`). */
export function AiBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent-strong/10 px-2 py-1 text-[10px] font-semibold tracking-wide text-accent-strong">
      <Icon icon={Sparkles} size="xs" />
      AI
    </span>
  );
}

export interface AiTranslatePanelProps {
  entity: AiEntity;
  sourceLocale: AiLocale;
  onSourceLocaleChange: (locale: AiLocale) => void;
  /** The text currently typed in `sourceLocale` — what gets sent to Gemini. */
  getFields: () => AiSourceFields;
  /** Other locales already filled (hand-edited or from a previous run) — never
   *  silently overwritten by the result unless a "Qayta tarjima" retry names them. */
  getExisting: () => Partial<Record<AiLocale, AiSourceFields>>;
  onResult: (result: AiTranslateResult) => void;
  /** Set once a create/update has actually run the AI pipeline server-side. */
  translationStatus?: "PENDING" | "COMPLETE" | "FAILED" | null;
  disabled?: boolean;
}

/**
 * "Kiritish tili" selector + "AI bilan tekshirish" button, shared by the
 * Product/Category/Brand forms (Stage C). Deliberately dumb: it only calls
 * `POST /ai/:entity/translate` and hands the raw result to `onResult` — each
 * form knows its own field layout well enough to decide what counts as
 * "already filled" and how to badge what changed, so merging happens there.
 */
export function AiTranslatePanel({
  entity,
  sourceLocale,
  onSourceLocaleChange,
  getFields,
  getExisting,
  onResult,
  translationStatus,
  disabled,
}: AiTranslatePanelProps) {
  const translate = useAiTranslate(entity);

  async function check(force: boolean) {
    const fields = getFields();
    if (!fields.name.trim()) return;

    try {
      const result = await translate.mutateAsync({
        sourceLocale,
        fields,
        existing: getExisting(),
        force,
        forceLocales: force ? [...AI_LOCALES] : undefined,
      });
      onResult(result);
    } catch {
      // requestErrorMessage below reads translate.error; nothing else to do.
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-md border border-dashed border-border bg-surface-muted/40 p-3">
      <FormField label="Kiritish tili" hint="Qaysi tilda yozayotganingiz.">
        <Select
          value={sourceLocale}
          onChange={(e) => onSourceLocaleChange(e.target.value as AiLocale)}
          disabled={disabled}
          className="w-40"
        >
          {AI_LOCALES.map((locale) => (
            <option key={locale} value={locale}>
              {LOCALE_LABEL[locale]}
            </option>
          ))}
        </Select>
      </FormField>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || translate.isPending}
        onClick={() => void check(false)}
      >
        <Icon icon={Sparkles} size="xs" />
        {translate.isPending ? "Tekshirilmoqda..." : "AI bilan tekshirish"}
      </Button>

      {translationStatus === "FAILED" ? (
        <span className="flex items-center gap-2 text-xs text-danger">
          Tarjima amalga oshmadi (Gemini bilan bog&apos;lanib bo&apos;lmadi). Manba til matni saqlanadi.
          <button
            type="button"
            className="underline underline-offset-2 hover:no-underline"
            onClick={() => void check(false)}
          >
            Qayta urinish
          </button>
        </span>
      ) : null}

      {translate.isError ? (
        <span className="text-xs text-danger">
          {requestErrorMessage(translate.error, "AI tekshiruvi ishlamadi.")}
        </span>
      ) : null}
    </div>
  );
}
