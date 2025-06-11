import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...");

  // Create demo user
  const hashedPassword = await bcrypt.hash("password123", 12);

  const user = await prisma.user.upsert({
    where: { email: "demo@example.com" },
    update: {},
    create: {
      firstName: "Demo",
      lastName: "User",
      email: "demo@example.com",
      password: hashedPassword,
    },
  });

  console.log("👤 Created demo user:", user.email);

  // Create demo chat
  const chat = await prisma.chat.create({
    data: {
      userId: user.id,
      title: "Sample Document Analysis",
      status: "NONE",
      state: "UPLOAD",
    },
  });

  console.log("💬 Created demo chat:", chat.title);

  // Create demo document
  const document = await prisma.document.create({
    data: {
      chatId: chat.id,
      name: "sample-report.pdf",
      filePath: "/uploads/sample-report.pdf",
      size: 1024000, // 1MB
      type: "application/pdf",
      processed: true,
    },
  });

  console.log("📄 Created demo document:", document.name);

  // Create demo messages
  const messages = await prisma.message.createMany({
    data: [
      {
        chatId: chat.id,
        sender: "USER",
        content: "What are the key findings in this report?",
        type: "QUERY",
      },
      {
        chatId: chat.id,
        sender: "ASSISTANT",
        content:
          "Based on the analysis of your document, here are the key findings:\n\n1. Revenue growth of 15% year-over-year\n2. Customer satisfaction scores improved to 4.2/5\n3. Market expansion into 3 new regions\n4. Cost optimization resulted in 8% savings\n\nThese findings indicate strong business performance across multiple metrics.",
        type: "RESPONSE",
      },
    ],
  });

  console.log("💬 Created demo messages:", messages.count);

  // Update chat state to CHAT since it has messages
  await prisma.chat.update({
    where: { id: chat.id },
    data: { state: "CHAT" },
  });

  console.log("✅ Database seed completed successfully!");
  console.log("\n📧 Demo credentials:");
  console.log("   Email: demo@example.com");
  console.log("   Password: password123");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
