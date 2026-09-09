import type { CheckoutRequestInput } from "@/lib/schemas";
import { uzRegionLabel } from "@/lib/data/uz-regions";

/**
 * The checkout form's validated payload, as the backend's `CreateCheckoutDto`
 * wants it. Backend now accepts every field the form collects (contact phone,
 * region, house, apartment, landmark, and all three payment methods), so this
 * is a near-identity transform — the one adjustment is resolving the region
 * `<select>`'s slug to the human label the DTO stores as a free string.
 */
export type BackendCheckoutBody = Omit<CheckoutRequestInput, "region"> & {
  region?: string;
};

export function toBackendCheckoutBody(input: CheckoutRequestInput): BackendCheckoutBody {
  return {
    ...input,
    region: input.region ? uzRegionLabel(input.region) : undefined,
  };
}
