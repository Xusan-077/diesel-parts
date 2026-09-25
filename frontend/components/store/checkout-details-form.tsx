"use client";

import { useCallback, useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Banknote, CreditCard, ExternalLink, Handshake, MapPin, Pencil } from "lucide-react";
import { checkoutRequestSchema, type CheckoutRequestInput } from "@/lib/schemas";
import { checkoutFieldError } from "@/lib/store/checkout-error-text";
import { formatNationalDigits } from "@/lib/auth/phone";
import { UZ_REGIONS } from "@/lib/data/uz-regions";
import { SITE_LOCATION } from "@/lib/site-config";
import { yandexEmbedUrl, yandexMapsUrl } from "@/lib/map-links";
import { cn } from "@/lib/utils";
import { DeliveryMap } from "@/components/store/delivery-map";
import type { ResolvedAddress } from "@/lib/yandex-maps/geocode";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import type { Profile } from "@/lib/account/profile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { CheckboxField } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { FlagIcon } from "@/components/layout/flag-icon";

export interface CheckoutDetailsFormProps {
  formId: string;
  lang: Locale;
  dict: Dictionary["checkout"];
  footerDict: Dictionary["footer"];
  profile: Profile;
  /** The session's phone-verified number, in canonical `998…` form. Pre-fills
   *  the contact-phone field; the shopper can still change it for this order. */
  defaultPhone?: string;
  /** Lifts the two choices that drive the order summary — the delivery line and
   *  the submit-button wording — up to CheckoutClient. */
  onChoicesChange?: (choices: {
    deliveryMethod: CheckoutRequestInput["deliveryMethod"];
    paymentMethod: CheckoutRequestInput["paymentMethod"];
  }) => void;
  onSubmit: (values: CheckoutRequestInput) => void;
}

/** The online-payment providers, as a placeholder selector. Only Payme is wired
 *  in backend/ today (checkout.service.ts hardcodes `provider: 'payme'`); the
 *  choice is not sent anywhere yet, so it lives in local state. */
const PAYMENT_PROVIDERS = [
  { id: "PAYME", label: "Payme", available: true },
  { id: "CLICK", label: "Click", available: false },
  { id: "PAYNET", label: "Paynet", available: false },
] as const;

/** A card heading with its step number in the checkout sequence. */
function SectionTitle({ step, children }: { step: number; children: React.ReactNode }) {
  return (
    <CardTitle className="flex items-center gap-2.5">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-surface-muted text-xs font-medium tabular-nums text-muted">
        {step}
      </span>
      {children}
    </CardTitle>
  );
}

/**
 * The customer / delivery / payment half of checkout — a self-contained form
 * with its own id, submitted from outside by whichever button (the desktop card
 * in CheckoutClient, or the mobile sheet in CheckoutSummarySheet) carries
 * `form={formId}`. Same remote-submit shape ProfileDetailsModal already uses.
 *
 * Four sections, top to bottom: who the order is for, how it travels, how it is
 * paid, and a free-text note. The running total and the submit button live in
 * CheckoutOrderSummary / CheckoutSummarySheet, keyed to this form by id.
 */
export function CheckoutDetailsForm({
  formId,
  lang,
  dict,
  footerDict,
  profile,
  defaultPhone,
  onChoicesChange,
  onSubmit,
}: CheckoutDetailsFormProps) {
  const {
    register,
    handleSubmit,
    control,
    getValues,
    setValue,
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
      phone: defaultPhone ? formatNationalDigits(defaultPhone) : "",
      deliveryMethod: "PICKUP",
      region: "",
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
  const paymentMethod = useWatch({ control, name: "paymentMethod" });
  const isDelivery = deliveryMethod === "DELIVERY";

  useEffect(() => {
    onChoicesChange?.({ deliveryMethod, paymentMethod });
  }, [deliveryMethod, paymentMethod, onChoicesChange]);

  // The profile store rehydrates from localStorage after the first client
  // render, so `defaultValues` above can be captured empty. Fill the name in
  // once it arrives, but only where the shopper has not already typed one.
  const hasProfileName = Boolean(profile.firstName && profile.lastName);
  useEffect(() => {
    if (!hasProfileName) {
      return;
    }
    if (!getValues("firstName")) {
      setValue("firstName", profile.firstName);
    }
    if (!getValues("lastName")) {
      setValue("lastName", profile.lastName);
    }
  }, [hasProfileName, profile.firstName, profile.lastName, getValues, setValue]);

  // Captured at mount: a shopper who arrived without a saved profile keeps the
  // fields open even if the store rehydrates a name a moment later, so the
  // section does not flip from fields to summary under them.
  const [startedWithProfile] = useState(hasProfileName);
  const [editingCustomer, setEditingCustomer] = useState(false);
  const showCustomerFields = !startedWithProfile || editingCustomer;

  const [provider, setProvider] = useState<string>("PAYME");

  // The delivery map fills the address fields from a dropped pin — street,
  // house and district only. Region stays the shopper's to pick: it drives a
  // `<select>` of slugs, not a free string, and a courier zone is a decision
  // the geocoder's "locality" does not always make correctly. Every write is
  // `shouldValidate` so a resolved address clears its own "required" error, and
  // the fields stay editable — the pin is a starting point, not a lock.
  const handlePointResolved = useCallback(
    ({ address }: { point: [number, number]; address: ResolvedAddress | null }) => {
      if (!address) {
        return;
      }
      const fill = (field: "street" | "house" | "district", value: string | undefined) => {
        if (value) {
          setValue(field, value, { shouldValidate: true, shouldDirty: true });
        }
      };
      fill("street", address.street);
      fill("house", address.house);
      fill("district", address.district);
    },
    [setValue],
  );

  const paymentMethodError = checkoutFieldError(dict, errors.paymentMethod?.message);

  const paymentOptions = [
    {
      value: "ONLINE" as const,
      icon: CreditCard,
      label: dict.paymentOnlineLabel,
      description: dict.paymentOnlineDescription,
    },
    // Cash needs someone at the counter to take it — pickup only.
    ...(isDelivery
      ? []
      : [
          {
            value: "CASH" as const,
            icon: Banknote,
            label: dict.paymentCashLabel,
            description: dict.paymentCashDescription,
          },
        ]),
    {
      value: "SELLER_AGREEMENT" as const,
      icon: Handshake,
      label: dict.paymentAgreementLabel,
      description: dict.paymentAgreementDescription,
    },
  ];

  return (
    <form id={formId} onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      {/* 1 — who the order is for --------------------------------------- */}
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4">
          <SectionTitle step={1}>{dict.customerTitle}</SectionTitle>
          {!showCustomerFields ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEditingCustomer(true)}
            >
              <Icon icon={Pencil} size="xs" />
              {dict.customerEditCta}
            </Button>
          ) : null}
        </CardHeader>

        {showCustomerFields ? (
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
            <Controller
              control={control}
              name="phone"
              render={({ field }) => (
                <FormField
                  label={dict.phoneLabel}
                  required
                  error={checkoutFieldError(dict, errors.phone?.message)}
                  className="sm:col-span-2"
                >
                  <span className="flex shrink-0 select-none items-center gap-1.5 text-sm text-muted">
                    <FlagIcon locale="uz" className="h-3 w-4.5 rounded-xs" />
                    +998
                  </span>
                  <Input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    placeholder="90 123 45 67"
                    value={field.value ?? ""}
                    onChange={(event) => field.onChange(formatNationalDigits(event.target.value))}
                    onBlur={field.onBlur}
                    ref={field.ref}
                  />
                </FormField>
              )}
            />
          </CardContent>
        ) : (
          <CardContent>
            <CustomerSummary
              dict={dict}
              firstName={getValues("firstName")}
              lastName={getValues("lastName")}
              phone={getValues("phone")}
            />
          </CardContent>
        )}
      </Card>

      {/* 2 — how it travels ------------------------------------------------ */}
      <Card>
        <CardHeader>
          <SectionTitle step={2}>{dict.deliveryTitle}</SectionTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <Controller
            control={control}
            name="deliveryMethod"
            render={({ field }) => (
              <RadioGroup
                name={field.name}
                value={field.value}
                onValueChange={(next) => {
                  field.onChange(next);
                  // Cash is pickup-only; drop it the moment delivery is chosen.
                  if (next === "DELIVERY" && getValues("paymentMethod") === "CASH") {
                    setValue("paymentMethod", "ONLINE", { shouldValidate: true });
                  }
                }}
              >
                <RadioGroupItem
                  value="DELIVERY"
                  label={dict.deliveryDeliveryLabel}
                  description={dict.deliveryDeliveryDescription}
                />
                <RadioGroupItem
                  value="PICKUP"
                  label={dict.deliveryPickupLabel}
                  description={dict.deliveryPickupDescription}
                />
              </RadioGroup>
            )}
          />

          {isDelivery ? (
            <div className="grid gap-5 sm:grid-cols-2">
              <DeliveryMap
                lang={lang}
                onPointResolved={handlePointResolved}
                labels={{
                  hint: dict.deliveryMapHint,
                  loading: dict.deliveryMapLoading,
                  error: dict.deliveryMapError,
                  pin: dict.deliveryMapPin,
                }}
                className="sm:col-span-2"
              />
              <FormField
                label={dict.regionLabel}
                required
                error={checkoutFieldError(dict, errors.region?.message)}
              >
                <Select {...register("region")}>
                  <option value="" disabled>
                    {dict.regionPlaceholder}
                  </option>
                  {UZ_REGIONS.map((region) => (
                    <option key={region.value} value={region.value}>
                      {region.label}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField
                label={dict.districtLabel}
                required
                error={checkoutFieldError(dict, errors.district?.message)}
              >
                <Input autoComplete="address-level2" {...register("district")} />
              </FormField>
              <FormField
                label={dict.streetLabel}
                required
                error={checkoutFieldError(dict, errors.street?.message)}
                className="sm:col-span-2"
              >
                <Input autoComplete="address-line1" {...register("street")} />
              </FormField>
              <FormField
                label={dict.houseLabel}
                required
                error={checkoutFieldError(dict, errors.house?.message)}
              >
                <Input {...register("house")} />
              </FormField>
              <FormField
                label={dict.apartmentLabel}
                error={checkoutFieldError(dict, errors.apartment?.message)}
              >
                <Input autoComplete="address-line2" {...register("apartment")} />
              </FormField>
              <FormField
                label={dict.landmarkLabel}
                error={checkoutFieldError(dict, errors.landmark?.message)}
                className="sm:col-span-2"
              >
                <Input {...register("landmark")} />
              </FormField>
              <FormField label={dict.deliveryNotesLabel} multiline className="sm:col-span-2">
                <Textarea rows={2} maxLength={500} {...register("deliveryNotes")} />
              </FormField>
            </div>
          ) : (
            <PickupInfo dict={dict} footerDict={footerDict} />
          )}
        </CardContent>
      </Card>

      {/* 3 — how it is paid --------------------------------------------- */}
      <Card>
        <CardHeader>
          <SectionTitle step={3}>{dict.paymentTitle}</SectionTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Controller
            control={control}
            name="paymentMethod"
            render={({ field }) => (
              <RadioGroup name={field.name} value={field.value} onValueChange={field.onChange}>
                {paymentOptions.map((option) => (
                  <RadioGroupItem
                    key={option.value}
                    value={option.value}
                    icon={option.icon}
                    label={option.label}
                    description={option.description}
                  />
                ))}
              </RadioGroup>
            )}
          />
          {paymentMethodError ? (
            <p role="alert" className="text-xs font-medium text-danger">
              {paymentMethodError}
            </p>
          ) : null}

          {paymentMethod === "ONLINE" ? (
            <div className="rounded-lg border border-border bg-surface-muted p-4">
              <p className="mb-2.5 text-xs font-medium text-muted">{dict.paymentProviderLabel}</p>
              <div className="flex flex-wrap gap-2">
                {PAYMENT_PROVIDERS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    disabled={!option.available}
                    onClick={() => setProvider(option.id)}
                    aria-pressed={provider === option.id}
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-sm transition-colors",
                      provider === option.id
                        ? "border-accent-edge bg-accent-subtle text-foreground"
                        : "border-border bg-surface text-muted hover:bg-surface-hover",
                      !option.available && "cursor-not-allowed opacity-50 hover:bg-surface",
                    )}
                  >
                    {option.label}
                    {option.available ? null : (
                      <span className="text-muted"> · {dict.paymentProviderSoon}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {paymentMethod === "SELLER_AGREEMENT" ? (
            <Alert variant="default">
              <AlertDescription>{dict.paymentAgreementNote}</AlertDescription>
            </Alert>
          ) : null}

          <CheckboxField
            label={dict.termsLabel}
            error={checkoutFieldError(dict, errors.termsAccepted?.message)}
            {...register("termsAccepted")}
          />
        </CardContent>
      </Card>

      {/* 4 — a note for the team -------------------------------------------- */}
      <Card>
        <CardContent>
          <FormField label={dict.notesLabel} multiline>
            <Textarea
              placeholder={dict.notesPlaceholder}
              maxLength={2000}
              rows={3}
              {...register("notes")}
            />
          </FormField>
        </CardContent>
      </Card>
    </form>
  );
}

/** The read-only customer block shown once a saved profile has filled it in. */
function CustomerSummary({
  dict,
  firstName,
  lastName,
  phone,
}: {
  dict: Dictionary["checkout"];
  firstName?: string;
  lastName?: string;
  phone?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm font-medium text-foreground">
        {[firstName, lastName].filter(Boolean).join(" ")}
      </p>
      {phone ? <p className="text-sm text-muted">+998 {phone}</p> : null}
      <p className="mt-1 text-xs text-muted">{dict.customerPrefilledHint}</p>
    </div>
  );
}

/** Where the counter is, when it is open, and a fixed map of it.
 *
 * The map is the keyless `map-widget` embed, not the interactive JS map the
 * delivery step uses: pickup is one address the shopper does not choose, so a
 * static picture with a marker on it is the whole requirement — and it keeps
 * working with no API key configured. If the iframe is blocked, the address
 * and hours above it are still the useful part of the panel. */
function PickupInfo({
  dict,
  footerDict,
}: {
  dict: Dictionary["checkout"];
  footerDict: Dictionary["footer"];
}) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface-muted p-4">
      <div className="flex gap-3">
        <Icon icon={MapPin} size="md" className="mt-0.5 text-accent-strong" />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-foreground">{dict.pickupInfoTitle}</p>
          <p className="text-sm text-muted">{footerDict.address}</p>
          <p className="text-sm text-muted">
            <span className="text-foreground">{dict.pickupHoursLabel}: </span>
            {footerDict.hours}
          </p>
          <a
            href={yandexMapsUrl(SITE_LOCATION)}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-2 self-start")}
          >
            {dict.pickupMapCta}
            <Icon icon={ExternalLink} size="xs" />
          </a>
        </div>
      </div>

      <div className="h-56 overflow-hidden rounded-lg border border-border bg-surface md:h-64">
        <iframe
          src={yandexEmbedUrl(SITE_LOCATION)}
          title={dict.pickupMapAlt}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="h-full w-full border-0"
        />
      </div>
    </div>
  );
}
