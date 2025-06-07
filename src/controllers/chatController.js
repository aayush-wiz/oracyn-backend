import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const getChats = async (req, res) => {
  try {
    const chats = await prisma.chat.findMany({
      where: { userId: req.userId },
      include: {
        messages: {
          select: { content: true, type: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        documents: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(chats);
  } catch (error) {
    console.error("Get chats error:", error);
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
    console.error("Create chat error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const updateChat = async (req, res) => {
  const { id } = req.params;
  const { status, title } = req.body;
  try {
    const chat = await prisma.chat.findFirst({
      where: { id: parseInt(id), userId: req.userId },
    });
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }
    const updatedChat = await prisma.chat.update({
      where: { id: parseInt(id) },
      data: {
        status: status || chat.status,
        title: title || chat.title,
        updatedAt: new Date(),
      },
    });
    res.json(updatedChat);
  } catch (error) {
    console.error("Update chat error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const deleteChat = async (req, res) => {
  const { id } = req.params;
  try {
    const chat = await prisma.chat.findFirst({
      where: { id: parseInt(id), userId: req.userId },
    });
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }
    await prisma.chat.delete({
      where: { id: parseInt(id) },
    });
    res.json({ message: "Chat deleted" });
  } catch (error) {
    console.error("Delete chat error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const getChatFiles = async (req, res) => {
  const { id } = req.params;
  try {
    const chat = await prisma.chat.findFirst({
      where: { id: parseInt(id), userId: req.userId },
    });
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }
    const documents = await prisma.document.findMany({
      where: { chatId: parseInt(id) },
      select: { id: true, name: true, filePath: true, size: true, type: true, uploadedAt: true },
    });
    res.json(documents.map(doc => ({
      url: doc.filePath,
      key: doc.filePath.split("/").pop(),
      name: doc.name,
      type: doc.type,
      size: doc.size,
    })));
  } catch (error) {
    console.error("Get chat files error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const submitQuery = async (req, res) => {
  const { id } = req.params;
  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "Prompt required" });
  }
  try {
    const chat = await prisma.chat.findFirst({
      where: { id: parseInt(id), userId: req.userId },
    });
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }
    const queryMessage = await prisma.message.create({
      data: {
        chatId: parseInt(id),
        sender: "USER",
        content: prompt,
        type: "QUERY",
      },
    });
    const responseMessage = await prisma.message.create({
      data: {
        chatId: parseInt(id),
        sender: "ASSISTANT",
        content: `AI response to: ${prompt}`, // Placeholder for AI integration
        type: "RESPONSE",
      },
    });
    await prisma.chat.update({
      where: { id: parseInt(id) },
      data: { updatedAt: new Date() },
    });
    res.json({ query: queryMessage, response: responseMessage });
  } catch (error) {
    console.error("Submit query error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const shareChat = async (req, res) => {
  const { id } = req.params;
  try {
    const chat = await prisma.chat.findFirst({
      where: { id: parseInt(id), userId: req.userId },
    });
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }
    // Generate a unique share link (placeholder; implement with your frontend URL)
    const shareLink = `${process.env.FRONTEND_URL}/share/${id}/${Date.now()}`;
    res.json({ shareLink });
  } catch (error) {
    console.error("Share chat error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export default { getChats, createChat, updateChat, deleteChat, getChatFiles, submitQuery, shareChat };