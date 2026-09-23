/**
 * Prisma client singleton. Standard Next.js dev pattern - without this,
 * every hot-reload in dev mode creates a new PrismaClient and eventually
 * exhausts the Postgres connection pool.
 */
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
