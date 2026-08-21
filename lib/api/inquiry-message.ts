export interface CartItemInput {
  sku: string;
  quantity: number;
}

/**
 * Folds a quote request's cart into the message body.
 *
 * There is no OrderItem table yet, and an inquiry that arrives without the
 * requested parts is not actionable, so the lines go into the text a seller
 * already reads.
 *
 * Kept apart from `inquiry-repository.ts` for the same reason `product-where.ts`
 * is kept apart from `product-repository.ts`: importing the repository pulls in
 * the Prisma client, and a pure formatter should be testable without a database.
 */
export function formatCartMessage(message: string, cartItems: CartItemInput[]): string {
  if (cartItems.length === 0) {
    return message;
  }

  const lines = cartItems.map((item) => `- ${item.sku} × ${item.quantity}`).join("\n");
  const cart = `Cart:\n${lines}`;

  return message.length === 0 ? cart : `${message}\n\n${cart}`;
}
