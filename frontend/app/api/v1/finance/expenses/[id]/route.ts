import { NextResponse } from "next/server";
import { authenticateDirector, parseJsonBody } from "@/lib/api/route-auth";
import { financeWriteError } from "@/lib/api/finance-route-errors";
import { deleteExpense, updateExpense } from "@/lib/api/finance-repository";
import { expenseWriteSchema } from "@/lib/schemas";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await authenticateDirector();
  if (!guard.ok) {
    return guard.response;
  }

  const body = await parseJsonBody(request, expenseWriteSchema);
  if (!body.ok) {
    return body.response;
  }

  const { id } = await params;
  try {
    return NextResponse.json({ success: true, expense: await updateExpense(id, body.data) });
  } catch (error) {
    return financeWriteError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await authenticateDirector();
  if (!guard.ok) {
    return guard.response;
  }

  const { id } = await params;
  try {
    await deleteExpense(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return financeWriteError(error);
  }
}
