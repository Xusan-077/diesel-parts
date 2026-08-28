import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../../generated/prisma/client';

/**
 * A self-checkout order has no seller to attach to — Order.sellerId is a
 * required FK, so one internal account holds every online order until a
 * staff member (or, later, a claim mechanism — not built yet) picks it up.
 * Same gap the abandoned backend-consolidation plan's Task 10 flagged for
 * CRM orders and never resolved; this is the minimal fix for checkout.
 *
 * `isActive: false` and a random, never-recorded password mean this account
 * can never sign in even if its row were somehow targeted directly — it
 * exists purely to satisfy the FK.
 */
export const HOUSE_SELLER_EMAIL = 'checkout@internal.diesel-parts.uz';

const BCRYPT_COST = 10; // matches AuthService's existing refresh-token hashing cost

export async function getOrCreateHouseSeller(
  prisma: PrismaService,
): Promise<{ id: string }> {
  const existing = await prisma.user.findUnique({
    where: { email: HOUSE_SELLER_EMAIL },
    include: { seller: true },
  });
  if (existing?.seller) {
    return existing.seller;
  }

  const passwordHash = await bcrypt.hash(
    randomBytes(32).toString('hex'),
    BCRYPT_COST,
  );
  const created = await prisma.user.create({
    data: {
      email: HOUSE_SELLER_EMAIL,
      name: 'Checkout (system account)',
      passwordHash,
      role: Role.SELLER,
      isActive: false,
      seller: { create: {} },
    },
    include: { seller: true },
  });
  return created.seller!;
}
