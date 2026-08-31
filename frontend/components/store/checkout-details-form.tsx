"use client";

import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { checkoutRequestSchema, type CheckoutRequestInput } from "@/lib/schemas";
import { checkoutFieldError } from "@/lib/store/checkout-error-text";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Profile } from "@/lib/account/profile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { CheckboxField } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export interface CheckoutDetailsFormProps {
  formId: string;
  dict: Dictionary["checkout"];
  profile: Profile;
  onSubmit: (values: CheckoutRequestInput) => void;
}

/**
 * The customer/delivery/terms half of checkout — a self-contained form with
 * its own id, submitted from outside by whichever button (the desktop card
 * in CheckoutClient, or the mobile sheet in CheckoutSummarySheet) carries
 * `form={formId}`. Same remote-submit shape ProfileDetailsModal already uses.
 */
export function CheckoutDetailsForm({ formId, dict, profile, onSubmit }: CheckoutDetailsFormProps) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    // `z.input` (not `CheckoutRequestInput`/`z.output`) for the field-values
    // generic: the schema's optional string fields go through `z.preprocess`,
    // whose input side Zod always types as `unknown`, so RHF's raw form state
    // has to be typed on that side while `handleSubmit`'s callback still gets
    // the validated `CheckoutRequestInput` (the resolver's third generic).
  } = useForm<z.input<typeof checkoutRequestSchema>, unknown, CheckoutRequestInput>({
    resolver: zodResolver(checkoutRequestSchema),
    defaultValues: {
      firstName: profile.firstName,
      lastName: profile.lastName,
      deliveryMethod: "PICKUP",
      termsAccepted: false,
      paymentMethod: "ONLINE",
    },
  });

  // `useWatch` rather than the `watch()` function React Hook Form's own
  // `useForm()` returns — that one is a plain function closing over mutable
  // internal state, which React Compiler cannot memoize safely (it skips
  // compiling this component instead). `useWatch` is a real hook with its own
  // subscription, so it composes cleanly with the compiler.
  const deliveryMethod = useWatch({ control, name: "deliveryMethod" });
  const isDelivery = deliveryMethod === "DELIVERY";

  return (
    <form id={formId} onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{dict.customerTitle}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <FormField
            label={dict.firstNameLabel}
            required
            error={checkoutFieldError(dict, errors.firstName?.message)}
          >
            <Input autoComplete="given-name" {...register("firstName")} />
          </FormField>
          <FormField
            label={dict.lastNameLabel}
            required
            error={checkoutFieldError(dict, errors.lastName?.message)}
          >
            <Input autoComplete="family-name" {...register("lastName")} />
          </FormField>
          <FormField label={dict.emailLabel} error={checkoutFieldError(dict, errors.email?.message)}>
            <Input type="email" autoComplete="email" {...register("email")} />
          </FormField>
          <FormField label={dict.companyNameLabel} hint={dict.companyOptionalHint}>
            <Input autoComplete="organization" {...register("companyName")} />
          </FormField>
          <FormField label={dict.taxIdLabel}>
            <Input {...register("taxId")} />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{dict.deliveryTitle}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <Controller
            control={control}
            name="deliveryMethod"
            render={({ field }) => (
              <RadioGroup name={field.name} value={field.value} onValueChange={field.onChange}>
                <RadioGroupItem
                  value="PICKUP"
                  label={dict.deliveryPickupLabel}
                  description={dict.deliveryPickupDescription}
                />
                <RadioGroupItem
                  value="DELIVERY"
                  label={dict.deliveryDeliveryLabel}
                  description={dict.deliveryDeliveryDescription}
                />
              </RadioGroup>
            )}
          />

          {isDelivery ? (
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField label={dict.cityLabel} required error={checkoutFieldError(dict, errors.city?.message)}>
                <Input {...register("city")} />
              </FormField>
              <FormField
                label={dict.districtLabel}
                required
                error={checkoutFieldError(dict, errors.district?.message)}
              >
                <Input {...register("district")} />
              </FormField>
              <FormField
                label={dict.streetLabel}
                required
                error={checkoutFieldError(dict, errors.street?.message)}
                className="sm:col-span-2"
              >
                <Input {...register("street")} />
              </FormField>
              <FormField label={dict.deliveryNotesLabel} multiline className="sm:col-span-2">
                <Textarea rows={2} maxLength={500} {...register("deliveryNotes")} />
              </FormField>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <FormField label={dict.notesLabel} multiline>
            <Textarea placeholder={dict.notesPlaceholder} maxLength={2000} rows={3} {...register("notes")} />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{dict.paymentTitle}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <RadioGroup name="paymentMethodDisplay" value="ONLINE" onValueChange={() => {}}>
            <RadioGroupItem
              value="ONLINE"
              label={dict.paymentOnlineLabel}
              description={dict.paymentOnlineDescription}
            />
            <RadioGroupItem value="CASH" label={dict.paymentCashLabel} description={dict.paymentCashDescription} disabled />
            <RadioGroupItem value="CARD" label={dict.paymentCardLabel} description={dict.paymentCardDescription} disabled />
          </RadioGroup>
          <input type="hidden" value="ONLINE" {...register("paymentMethod")} />

          <CheckboxField
            label={dict.termsLabel}
            error={checkoutFieldError(dict, errors.termsAccepted?.message)}
            {...register("termsAccepted")}
          />
        </CardContent>
      </Card>
    </form>
  );
}
