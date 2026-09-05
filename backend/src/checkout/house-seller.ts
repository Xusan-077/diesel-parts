import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../../generated/prisma/client';

/**
 * A self-checkout order has no seller to attach to — `Order.sellerId` is a
 * required FK **to `User`**, so one internal user account holds every online
 * order until a staff member (or, later, a claim mechanism — not built yet)
 * picks it up. Same gap the abandoned backend-consolidation plan's Task 10
 * flagged for CRM orders and never resolved; this is the minimal fix for
 * checkout.
 *
 * No `Seller` profile is attached — the FK points straight at `User`, and this
 * account never raises CRM orders that would need a default warehouse.
 * `isActive: false` and a random, never-recorded password mean it can never
 * sign in even if its row were somehow targeted directly — it exists purely to
 * satisfy the FK.
 */
export const HOUSE_SELLER_EMAIL = 'checkout@internal.diesel-parts.uz';

const BCRYPT_COST = 10; // matches AuthService's existing refresh-token hashing cost

/** Returns the internal user id that owns unclaimed self-checkout orders. */
export async function getOrCreateHouseSeller(
  prisma: PrismaService,
): Promise<{ id: string }> {
  const existing = await prisma.user.findUnique({
    where: { email: HOUSE_SELLER_EMAIL },
    select: { id: true },
  });
  if (existing) {
    return existing;
  }

  const passwordHash = await bcrypt.hash(
    randomBytes(32).toString('hex'),
    BCRYPT_COST,
  );
  return prisma.user.create({
    data: {
      email: HOUSE_SELLER_EMAIL,
      name: 'Checkout (system account)',
      passwordHash,
      role: Role.SELLER,
      isActive: false,
    },
    select: { id: true },
  });
}
