import { NextResponse } from "next/server";
import { authenticateStaff, parseJsonBody, parseQuery } from "@/lib/api/route-auth";
import { createCustomer, listCustomers } from "@/lib/api/customer-repository";
import { customerCreateSchema, customerListQuerySchema } from "@/lib/schemas";

/**
 * A seller's customer book, or with `?pool=true` the unassigned accounts they
 * may claim. A director sees every customer either way.
 */
export async function GET(request: Request) {
  const guard = await authenticateStaff();
  if (!guard.ok) {
    return guard.response;
  }

  const query = parseQuery(request.url, customerListQuerySchema);
  if (!query.ok) {
    return query.response;
  }

  return NextResponse.json({ success: true, ...(await listCustomers(guard.user, query.data)) });
}

/**
 * Adds a customer. The phone is not checked for uniqueness — `Customer.phone`
 * is deliberately non-unique, because a company switchboard is shared by
 * several contacts. Search the list by number first if a match matters.
 */
export async function POST(request: Request) {
  const guard = await authenticateStaff();
  if (!guard.ok) {
    return guard.response;
  }

  const body = await parseJsonBody(request, customerCreateSchema);
  if (!body.ok) {
    return body.response;
  }

  const result = await createCustomer(body.data, guard.user);

  return NextResponse.json({ success: true, id: result.id }, { status: 201 });
}
