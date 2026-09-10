import { NextResponse } from "next/server";
import { authenticateDirector, parseJsonBody } from "@/lib/api/route-auth";
import { financeWriteError } from "@/lib/api/finance-route-errors";
import { recordDebtPayment } from "@/lib/api/finance-repository";
import { debtPaymentSchema } from "@/lib/schemas";

/** Records a staff-taken partial (or clearing) payment against a debtor's order. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const guard = await authenticateDirector();
  if (!guard.ok) {
    return guard.response;
  }

  const body = await parseJsonBody(request, debtPaymentSchema);
  if (!body.ok) {
    return body.response;
  }

  const { orderId } = await params;
  try {
    return NextResponse.json({ success: true, debt: await recordDebtPayment(orderId, body.data) });
  } catch (error) {
    return financeWriteError(error);
  }
}
