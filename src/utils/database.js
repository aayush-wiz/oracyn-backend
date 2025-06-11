import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Database connection helper
export const connectDatabase = async () => {
  try {
    await prisma.$connect();
    console.log("📊 Database connected successfully");
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    process.exit(1);
  }
};

// Graceful shutdown
export const disconnectDatabase = async () => {
  try {
    await prisma.$disconnect();
    console.log("📊 Database disconnected");
  } catch (error) {
    console.error("❌ Database disconnection failed:", error);
  }
};
