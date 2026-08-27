import "server-only";
import { prisma } from "@/lib/db";
import { mergeCartItems } from "@/lib/store/cart";
import type { Prisma } from "@/prisma/generated/prisma/client";

/**
 * The server-side cart for a logged-in (phone-verified) shopper.
 *
 * Keyed by canonical phone rather than a userId — there is no shopper login
 * beyond the OTP session (lib/auth/session.ts), and a Customer CRM row is
 * only created at checkout, not at login. A guest's cart stays in
 * localStorage (lib/store/cart.ts) until they verify a code, at which point
 * mergeGuestCart folds it in here.
 */

export interface CartItemRow {
  productId: string;
  quantity: number;
}

export interface CartRow {
  items: CartItemRow[];
}

const ITEMS_SELECT = {
  items: { select: { productId: true, quantity: true } },
} satisfies Prisma.CartSelect;

function toRow(cart: { items: CartItemRow[] } | null): CartRow {
  return { items: cart?.items ?? [] };
}

export async function getCart(phone: string): Promise<CartRow> {
  const cart = await prisma.cart.findUnique({ where: { phone }, select: ITEMS_SELECT });
  return toRow(cart);
}

async function getOrCreateCartId(phone: string): Promise<string> {
  const cart = await prisma.cart.upsert({
    where: { phone },
    create: { phone },
    update: {},
    select: { id: true },
  });
  return cart.id;
}

/** Sets an absolute quantity for one line, adding it if it is not there yet. */
export async function setCartItem(
  phone: string,
  productId: string,
  quantity: number
): Promise<CartRow> {
  const cartId = await getOrCreateCartId(phone);

  await prisma.cartItem.upsert({
    where: { cartId_productId: { cartId, productId } },
    create: { cartId, productId, quantity },
    update: { quantity },
  });

  return getCart(phone);
}

export async function removeCartItem(phone: string, productId: string): Promise<CartRow> {
  const cart = await prisma.cart.findUnique({ where: { phone }, select: { id: true } });
  if (cart) {
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id, productId } });
  }
  return getCart(phone);
}

export async function clearCart(phone: string): Promise<void> {
  const cart = await prisma.cart.findUnique({ where: { phone }, select: { id: true } });
  if (cart) {
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  }
}

/**
 * Folds a guest cart into the server cart, once, right after login.
 *
 * The merge itself (how duplicate lines combine) is mergeCartItems — pure,
 * unit-tested, and shared with any other caller that ever needs it. This
 * function is only the read-merge-write around it.
 */
export async function mergeGuestCart(
  phone: string,
  guestItems: readonly CartItemRow[]
): Promise<CartRow> {
  if (guestItems.length === 0) {
    return getCart(phone);
  }

  const server = await getCart(phone);
  const merged = mergeCartItems(server.items, guestItems);
  const cartId = await getOrCreateCartId(phone);

  await prisma.$transaction(
    merged.map((item) =>
      prisma.cartItem.upsert({
        where: { cartId_productId: { cartId, productId: item.productId } },
        create: { cartId, productId: item.productId, quantity: item.quantity },
        update: { quantity: item.quantity },
      })
    )
  );

  return { items: merged };
}
