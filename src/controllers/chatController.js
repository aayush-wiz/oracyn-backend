// backend/src/controllers/chatController.js (UPDATED)
import { PrismaClient } from "@prisma/client";
import { aiService } from "../services/aiService.js";

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
        processed: true,
      },
    });
    res.json(
      documents.map((doc) => ({
        id: doc.id,
        url: doc.filePath,
        key: doc.filePath.split("/").pop(),
        name: doc.name,
        type: doc.type,
        size: doc.size,
        processed: doc.processed,
      }))
    );
  } catch (error) {
    console.error("Get chat files error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

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
      select: { id: true, name: true, type: true, size: true, processed: true },
    });

    res.json({ messages, documents, chatState: chat.state });
  } catch (error) {
    console.error("Get chat messages error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

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

    // Generate AI response using AI service
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

    // Generate AI response using AI service
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
    // Generate a unique share link
    const shareLink = `${process.env.FRONTEND_URL}/share/${id}/${Date.now()}`;
    res.json({ shareLink });
  } catch (error) {
    console.error("Share chat error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// UPDATED: AI response generation using AI service
async function generateAIResponse(userMessage, chatId) {
  try {
    // Call AI service for RAG query
    const response = await aiService.processQuery({
      chat_id: chatId,
      query: userMessage,
      max_results: 10,
    });

    // Format response with sources if available
    let formattedResponse = response.answer;

    if (response.sources && response.sources.length > 0) {
      formattedResponse += "\n\n**Sources:**\n";
      response.sources.forEach((source, index) => {
        formattedResponse += `${index + 1}. ${source.file_name} (Relevance: ${(
          source.relevance_score * 100
        ).toFixed(1)}%)\n`;
      });
    }

    if (response.confidence) {
      formattedResponse += `\n*Confidence: ${(
        response.confidence * 100
      ).toFixed(1)}%*`;
    }

    return formattedResponse;
  } catch (error) {
    console.error("AI service error:", error);

    // Fallback response if AI service fails
    const documents = await prisma.document.findMany({
      where: { chatId },
      select: { name: true, type: true, processed: true },
    });

    return `I apologize, but I'm currently experiencing technical difficulties processing your question. 

**Your uploaded documents:**
${documents
  .map(
    (doc) => `• ${doc.name} (${doc.processed ? "Processed" : "Processing..."})`
  )
  .join("\n")}

Please try again in a moment. If the issue persists, please contact support.

*Error: ${error.message}*`;
  }
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
