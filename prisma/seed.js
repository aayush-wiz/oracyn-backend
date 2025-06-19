const { PrismaClient } = require("@prisma/client");
const { hashPassword } = require("../src/utils/bcrypt");

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seeding...");

  try {
    // Create demo users
    const demoUsers = await createDemoUsers();
    console.log(`✅ Created ${demoUsers.length} demo users`);

    // Create demo chats and related data
    const demoChats = await createDemoChats(demoUsers);
    console.log(`✅ Created ${demoChats.length} demo chats`);

    console.log("🎉 Database seeding completed successfully!");
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    throw error;
  }
}

async function createDemoUsers() {
  const users = [];

  // Admin user
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@oracyn.com" },
    update: {},
    create: {
      email: "admin@oracyn.com",
      username: "admin",
      password: await hashPassword("AdminPass123!"),
      firstName: "Admin",
      lastName: "User",
      profession: "System Administrator",
      bio: "System administrator for Oracyn platform",
      isVerified: true,
      isActive: true,
    },
  });
  users.push(adminUser);

  // Demo user 1
  const demoUser1 = await prisma.user.upsert({
    where: { email: "john.doe@example.com" },
    update: {},
    create: {
      email: "john.doe@example.com",
      username: "johndoe",
      password: await hashPassword("UserPass123!"),
      firstName: "John",
      lastName: "Doe",
      profession: "Data Scientist",
      bio: "Data scientist passionate about document intelligence and AI",
      isVerified: true,
      isActive: true,
    },
  });
  users.push(demoUser1);

  // Demo user 2
  const demoUser2 = await prisma.user.upsert({
    where: { email: "jane.smith@example.com" },
    update: {},
    create: {
      email: "jane.smith@example.com",
      username: "janesmith",
      password: await hashPassword("UserPass123!"),
      firstName: "Jane",
      lastName: "Smith",
      profession: "Business Analyst",
      bio: "Business analyst specializing in data visualization and reporting",
      isVerified: true,
      isActive: true,
    },
  });
  users.push(demoUser2);

  // Unverified user
  const unverifiedUser = await prisma.user.upsert({
    where: { email: "unverified@example.com" },
    update: {},
    create: {
      email: "unverified@example.com",
      username: "unverified",
      password: await hashPassword("UserPass123!"),
      firstName: "Unverified",
      lastName: "User",
      profession: "Tester",
      bio: "Test user for email verification flow",
      isVerified: false,
      isActive: true,
      emailVerificationToken: "demo-verification-token-123",
      emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
    },
  });
  users.push(unverifiedUser);

  return users;
}

async function createDemoChats(users) {
  const chats = [];

  // Create chats for John Doe
  const johnDoe = users.find((u) => u.username === "johndoe");
  if (johnDoe) {
    // Chat 1: Financial Analysis
    const financialChat = await prisma.chat.create({
      data: {
        title: "Q4 Financial Analysis",
        userId: johnDoe.id,
        messages: {
          create: [
            {
              content:
                "Welcome! Upload your financial documents to get started with analysis.",
              role: "assistant",
            },
            {
              content:
                "I need to analyze our Q4 financial performance and create some charts.",
              role: "user",
            },
            {
              content:
                "I can help you analyze financial documents and create visualizations. Please upload your Q4 financial reports.",
              role: "assistant",
            },
          ],
        },
      },
    });
    chats.push(financialChat);

    // Chat 2: Market Research
    const marketChat = await prisma.chat.create({
      data: {
        title: "Market Research Analysis",
        userId: johnDoe.id,
        messages: {
          create: [
            {
              content: "How can I help you with your market research today?",
              role: "assistant",
            },
            {
              content:
                "I have market research data that needs to be visualized for our executive presentation.",
              role: "user",
            },
            {
              content:
                "Perfect! I can help create professional charts and insights from your market research data. What type of data do you have?",
              role: "assistant",
            },
            {
              content:
                "Customer survey results, competitor analysis, and market sizing data.",
              role: "user",
            },
          ],
        },
      },
    });
    chats.push(marketChat);
  }

  // Create chats for Jane Smith
  const janeSmith = users.find((u) => u.username === "janesmith");
  if (janeSmith) {
    // Chat 1: Sales Dashboard
    const salesChat = await prisma.chat.create({
      data: {
        title: "Sales Performance Dashboard",
        userId: janeSmith.id,
        messages: {
          create: [
            {
              content:
                "Hi! Ready to create some amazing visualizations from your data?",
              role: "assistant",
            },
            {
              content:
                "Yes! I need to create a sales dashboard for our monthly review.",
              role: "user",
            },
            {
              content:
                "Great! I can help you build comprehensive sales dashboards. What metrics would you like to focus on?",
              role: "assistant",
            },
          ],
        },
      },
    });
    chats.push(salesChat);

    // Chat 2: Customer Analytics
    const customerChat = await prisma.chat.create({
      data: {
        title: "Customer Analytics Report",
        userId: janeSmith.id,
        messages: {
          create: [
            {
              content:
                "Welcome to Oracyn! What would you like to analyze today?",
              role: "assistant",
            },
            {
              content:
                "I want to analyze customer behavior patterns and create insights.",
              role: "user",
            },
          ],
        },
      },
    });
    chats.push(customerChat);
  }

  return chats;
}

// Handle script execution
main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
