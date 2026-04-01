import { PrismaClient } from "../generated/prisma/client";

let prismaInstance: PrismaClient | null = null;

function initializePrisma(): PrismaClient {
  if (!prismaInstance) {
    console.log("🔄 Initializing Prisma Client...");
    prismaInstance = new PrismaClient({
      log: ["error", "warn"], // Only log errors and warnings, not queries
    });
    console.log("✅ Prisma Client initialized");
  }
  return prismaInstance;
}

export function getPrisma(): PrismaClient {
  return initializePrisma();
}

// Lazy initialize via Proxy - this will only instantiate when first accessed
export const prisma = new Proxy({} as any, {
  get(_target: any, prop: string | symbol): any {
    const instance = initializePrisma();
    return (instance as any)[prop];
  },
}) as PrismaClient;
