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
        state: "UPLOAD", // Initialize in upload state
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
  const { status, title, state } = req.body;
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
        state: state || chat.state,
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
      select: {
        id: true,
        name: true,
        filePath: true,
        size: true,
        type: true,
        uploadedAt: true,
      },
    });
    res.json(
      documents.map((doc) => ({
        url: doc.filePath,
        key: doc.filePath.split("/").pop(),
        name: doc.name,
        type: doc.type,
        size: doc.size,
      }))
    );
  } catch (error) {
    console.error("Get chat files error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// NEW: Get chat messages
const getChatMessages = async (req, res) => {
  const { id } = req.params;
  try {
    const chat = await prisma.chat.findFirst({
      where: { id: parseInt(id), userId: req.userId },
    });
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    const messages = await prisma.message.findMany({
      where: { chatId: parseInt(id) },
      orderBy: { createdAt: "asc" },
    });

    const documents = await prisma.document.findMany({
      where: { chatId: parseInt(id) },
      select: { id: true, name: true, type: true, size: true },
    });

    res.json({ messages, documents, chatState: chat.state });
  } catch (error) {
    console.error("Get chat messages error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// NEW: Send message to chat
const sendMessage = async (req, res) => {
  const { id } = req.params;
  const { content, type = "REGULAR" } = req.body;

  if (!content) {
    return res.status(400).json({ error: "Message content required" });
  }

  try {
    const chat = await prisma.chat.findFirst({
      where: { id: parseInt(id), userId: req.userId },
    });
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    // Create user message
    const userMessage = await prisma.message.create({
      data: {
        chatId: parseInt(id),
        sender: "USER",
        content,
        type,
      },
    });

    // Generate AI response (placeholder - integrate with your AI service)
    const aiResponse = await generateAIResponse(content, parseInt(id));

    const assistantMessage = await prisma.message.create({
      data: {
        chatId: parseInt(id),
        sender: "ASSISTANT",
        content: aiResponse,
        type: "RESPONSE",
      },
    });

    // Update chat timestamp and state
    await prisma.chat.update({
      where: { id: parseInt(id) },
      data: {
        updatedAt: new Date(),
        state: "CHAT", // Move to chat state when first message is sent
      },
    });

    res.json({ userMessage, assistantMessage });
  } catch (error) {
    console.error("Send message error:", error);
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

    // Generate AI response
    const aiResponse = await generateAIResponse(prompt, parseInt(id));

    const responseMessage = await prisma.message.create({
      data: {
        chatId: parseInt(id),
        sender: "ASSISTANT",
        content: aiResponse,
        type: "RESPONSE",
      },
    });

    // Update chat state to CHAT
    await prisma.chat.update({
      where: { id: parseInt(id) },
      data: {
        updatedAt: new Date(),
        state: "CHAT",
      },
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

// Helper function to generate AI response (placeholder - replace with your AI service later)
async function generateAIResponse(userMessage, chatId) {
  // Get documents for context
  const documents = await prisma.document.findMany({
    where: { chatId },
    select: { name: true, type: true },
  });

  // Simple placeholder response - replace with your AI service call
  return `I've received your message: "${userMessage}". I can see you have ${
    documents.length
  } document${documents.length > 1 ? "s" : ""} uploaded. I'll analyze ${
    documents.length > 0 ? "them" : "this"
  } and provide insights once the AI service is integrated.

**Uploaded Documents:**
${documents.map((doc) => `• ${doc.name} (${doc.type})`).join("\n")}

*This is a placeholder response. The actual AI analysis will be implemented later.*`;
}

export default {
  getChats,
  createChat,
  updateChat,
  deleteChat,
  getChatFiles,
  getChatMessages,
  sendMessage,
  submitQuery,
  shareChat,
};
