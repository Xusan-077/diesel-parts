import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/prisma/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set. See .env.example.");
}

function createClient(): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

/**
 * Next.js hot-reloads server modules in development, which would otherwise
 * open a new pool on every edit until Postgres refuses connections.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
