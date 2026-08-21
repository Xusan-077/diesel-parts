import "server-only";
import { NextResponse } from "next/server";
import type { ZodError, ZodType } from "zod";
import { getStaffUser, type StaffUser } from "@/lib/auth/dal";

/**
 * Route-handler counterpart to `requireStaff`/`requireDirector` in the DAL.
 * Pages redirect; an API has to answer with a status code, so the guard hands
 * back a ready-made response instead of navigating.
 */
export type StaffGuard =
  | { ok: true; user: StaffUser }
  | { ok: false; response: NextResponse };

export function apiError(status: number, message: string): NextResponse {
  return NextResponse.json({ success: false, errors: { _root: [message] } }, { status });
}

export async function authenticateStaff(): Promise<StaffGuard> {
  const user = await getStaffUser();

  if (!user) {
    return { ok: false, response: apiError(401, "Sign in to continue.") };
  }

  return { ok: true, user };
}

export async function authenticateDirector(): Promise<StaffGuard> {
  const guard = await authenticateStaff();

  if (!guard.ok) {
    return guard;
  }

  if (guard.user.role !== "DIRECTOR") {
    // 403, not 404: the seller is known, and hiding the route's existence buys
    // nothing when the panel navigation is the same code they already run.
    return { ok: false, response: apiError(403, "This action is for directors only.") };
  }

  return guard;
}

/**
 * The 401/403 pair above answers "may you call this at all". These three answer
 * "is what you sent usable", in the one response shape the panel's fetch layer
 * already reads: `{ success: false, errors: { <field>: [...] } }`, with root
 * complaints under `_root`.
 */
export function validationError(error: ZodError): NextResponse {
  // `flatten()` types its field map from the schema's own shape, which this
  // helper is deliberately blind to; it is a string-keyed map either way.
  const flat = error.flatten() as {
    formErrors: string[];
    fieldErrors: Record<string, string[] | undefined>;
  };
  const errors: Record<string, string[]> = {};

  for (const [field, messages] of Object.entries(flat.fieldErrors)) {
    if (messages) {
      errors[field] = messages;
    }
  }

  // A whole-object rule — "send at least one field" — has no field to sit under.
  if (flat.formErrors.length > 0) {
    errors._root = flat.formErrors;
  }

  return NextResponse.json({ success: false, errors }, { status: 400 });
}

export type ParsedBody<T> = { ok: true; data: T } | { ok: false; response: NextResponse };

export async function parseJsonBody<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<ParsedBody<T>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { ok: false, response: apiError(400, "Invalid JSON body") };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, response: validationError(parsed.error) };
  }

  return { ok: true, data: parsed.data };
}

/** Query strings arrive as strings; the schema coerces what needs coercing. */
export function parseQuery<T>(url: string, schema: ZodType<T>): ParsedBody<T> {
  const params = Object.fromEntries(new URL(url).searchParams);
  const parsed = schema.safeParse(params);

  return parsed.success
    ? { ok: true, data: parsed.data }
    : { ok: false, response: validationError(parsed.error) };
}
