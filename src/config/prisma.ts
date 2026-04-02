import { PrismaClient } from "../generated/prisma/client";

let prismaInstance: PrismaClient | null = null;

function initializePrisma(): PrismaClient {
  if (!prismaInstance) {
    // Check if DATABASE_URL is set
    if (!process.env.DATABASE_URL) {
      console.error("❌ DATABASE_URL environment variable is not set!");
      console.error(
        "Please ensure DATABASE_URL is provided before starting the application.",
      );
      console.error(
        "Example: DATABASE_URL='postgresql://user:password@localhost:5432/dbname'",
      );
      throw new Error(
        "DATABASE_URL environment variable is required but not found",
      );
    }

    console.log("🔄 Initializing Prisma Client with DATABASE_URL...");
    try {
      prismaInstance = new PrismaClient({
        log: ["error", "warn"],
        errorFormat: "pretty",
      });
      console.log("✅ Prisma Client initialized successfully");
    } catch (error) {
      console.error(
        "❌ Failed to initialize Prisma Client:",
        error instanceof Error ? error.message : error,
      );
      throw error;
    }
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

// Graceful shutdown
process.on("SIGTERM", async () => {
  if (prismaInstance) {
    console.log("🔌 Disconnecting Prisma Client...");
    await prismaInstance.$disconnect();
  }
});

process.on("SIGINT", async () => {
  if (prismaInstance) {
    console.log("🔌 Disconnecting Prisma Client...");
    await prismaInstance.$disconnect();
  }
});
