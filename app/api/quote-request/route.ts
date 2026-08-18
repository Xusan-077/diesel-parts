import { NextResponse } from "next/server";
import { quoteRequestSchema } from "@/lib/schemas";
import { createInquiry } from "@/lib/api/inquiry-repository";
import { formatCartMessage } from "@/lib/api/inquiry-message";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, errors: { _root: ["Invalid JSON body"] } },
      { status: 400 }
    );
  }

  const result = quoteRequestSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { success: false, errors: result.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { cartItems, ...contact } = result.data;

  /*
   * The quote form asks for company, country, what they want and how many, and
   * none of those has a column. Dropping them would leave a seller with a name
   * and a phone number, so they go into the message body alongside the cart.
   */
  const details = [
    `Company: ${contact.company}`,
    `Country: ${contact.country}`,
    `Products: ${contact.products}`,
    `Quantity: ${contact.quantity}`,
  ].join("\n");

  const written = contact.message?.trim() ?? "";
  const messageBody = written.length > 0 ? `${written}\n\n${details}` : details;

  try {
    await createInquiry({
      customerName: contact.name,
      phone: contact.phone,
      email: contact.email,
      message: formatCartMessage(messageBody, cartItems ?? []),
      source: "QUOTE_FORM",
    });
  } catch (error) {
    console.error("[quote-request] failed to persist", error);
    return NextResponse.json(
      { success: false, errors: { _root: ["Could not save your request. Please try again."] } },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
