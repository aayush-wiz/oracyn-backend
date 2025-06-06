import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const getChats = async (req, res) => {
  try {
    const chats = await prisma.chat.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: "desc" },
    });
    res.json(chats);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

const createChat = async (req, res) => {
  const { title } = req.body;
  try {
    const chat = await prisma.chat.create({
      data: {
        userId: req.userId,
        title: title || "New Chat",
      },
    });
    res.status(201).json(chat);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

export default { getChats, createChat };
