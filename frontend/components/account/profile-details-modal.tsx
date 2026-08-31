"use client";

import { useEffect, useId } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { accountFieldError } from "@/lib/account/error-text";
import { GENDERS, type Profile } from "@/lib/account/profile";
import { profileDetailsSchema, type ProfileDetailsInput } from "@/lib/schemas";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { FormModalShell } from "@/components/ui/form-modal-shell";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type Panel = Dictionary["account"]["profilePanel"];

export function ProfileDetailsModal({
  panel,
  open,
  onOpenChange,
  profile,
  onSave,
}: {
  panel: Panel;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: Profile;
  onSave: (profile: Profile) => void;
}) {
  const formId = useId();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProfileDetailsInput>({
    resolver: zodResolver(profileDetailsSchema),
    defaultValues: profile,
  });

  // The store rehydrates after mount and the visitor can edit twice in a row,
  // so the stored profile — not the mount-time default — is what a freshly
  // opened form has to show.
  useEffect(() => {
    if (open) {
      reset(profile);
    }
  }, [open, profile, reset]);

  function onSubmit(values: ProfileDetailsInput) {
    onSave(values);
    toast.success(panel.saved);
    onOpenChange(false);
  }

  const genderLabel: Record<(typeof GENDERS)[number], string> = {
    male: panel.genderMale,
    female: panel.genderFemale,
  };

  return (
    <FormModalShell
      open={open}
      onOpenChange={onOpenChange}
      title={panel.detailsModalTitle}
      description={panel.detailsModalSubtitle}
      closeLabel={panel.close}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {panel.cancel}
          </Button>
          <Button type="submit" form={formId} disabled={isSubmitting}>
            {isSubmitting ? panel.saving : panel.save}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="grid gap-5 sm:grid-cols-2"
      >
        <FormField label={panel.firstName} error={accountFieldError(panel, errors.firstName?.message)}>
          <Input autoComplete="given-name" {...register("firstName")} />
        </FormField>

        <FormField label={panel.lastName} error={accountFieldError(panel, errors.lastName?.message)}>
          <Input autoComplete="family-name" {...register("lastName")} />
        </FormField>

        <FormField label={panel.birthDate} error={accountFieldError(panel, errors.birthDate?.message)}>
          <Input type="date" autoComplete="bday" {...register("birthDate")} />
        </FormField>

        <FormField label={panel.gender} error={accountFieldError(panel, errors.gender?.message)}>
          <Select {...register("gender")}>
            <option value="">{panel.genderUnset}</option>
            {GENDERS.map((gender) => (
              <option key={gender} value={gender}>
                {genderLabel[gender]}
              </option>
            ))}
          </Select>
        </FormField>
      </form>
    </FormModalShell>
  );
}
