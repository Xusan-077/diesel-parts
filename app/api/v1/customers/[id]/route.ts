import { NextResponse } from "next/server";
import { apiError, authenticateStaff, parseJsonBody } from "@/lib/api/route-auth";
import { getCustomer, updateCustomer } from "@/lib/api/customer-repository";
import { customerUpdateSchema } from "@/lib/schemas";

/** Readable by the owner, by a director, and — while unclaimed — by any seller. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await authenticateStaff();
  if (!guard.ok) {
    return guard.response;
  }

  const { id } = await params;
  const customer = await getCustomer(id, guard.user);

  if (customer === null) {
    return apiError(404, "Mijoz topilmadi.");
  }

  return NextResponse.json({ success: true, customer });
}

/**
 * Editable only by the seller the account belongs to, or a director. Reading a
 * pooled customer is allowed; changing one is not — claim it first.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await authenticateStaff();
  if (!guard.ok) {
    return guard.response;
  }

  const { id } = await params;

  const body = await parseJsonBody(request, customerUpdateSchema);
  if (!body.ok) {
    return body.response;
  }

  const result = await updateCustomer(id, body.data, guard.user);

  if (!result.ok) {
    return apiError(404, "Mijoz topilmadi yoki sizga biriktirilmagan.");
  }

  return NextResponse.json({ success: true, id });
}
