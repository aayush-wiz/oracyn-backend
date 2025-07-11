const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const axios = require("axios");

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

const getChats = async (req, res) => {
  try {
    const chats = await prisma.chat.findMany({
      where: { userId: req.user.id },
      orderBy: { updatedAt: "desc" },
    });
    res.status(200).json(chats);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to retrieve chats", error: error.message });
  }
};

const createChat = async (req, res) => {
  const { title } = req.body;

  if (!title) {
    return res
      .status(400)
      .json({ message: "A title is required for the chat." });
  }

  try {
    const chats = await prisma.chat.findMany({
      where: { userId: req.user.id },
      include: { messages: true },
    });

    const hasDuplicateTitle = chats.some((chat) => chat.title === title);
    if (hasDuplicateTitle) {
      return res
        .status(400)
        .json({ message: "A chat with this title already exists." });
    }

    const hasEmptyChat = chats.some((chat) => chat.messages.length === 0);
    if (hasEmptyChat) {
      return res
        .status(400)
        .json({ message: "You already have an empty chat." });
    }

    const newChat = await prisma.chat.create({
      data: { title, userId: req.user.id },
    });

    return res.status(201).json(newChat);
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to create chat", error: error.message });
  }
};

const getChatById = async (req, res) => {
  try {
    const chat = await prisma.chat.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: { messages: { orderBy: { timestamp: "asc" } }, documents: true },
    });
    if (!chat) {
      return res
        .status(404)
        .json({ message: "Chat not found or not authorized" });
    }
    res.status(200).json(chat);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to retrieve chat", error: error.message });
  }
};

const deleteChat = async (req, res) => {
  try {
    const chat = await prisma.chat.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!chat) {
      return res
        .status(404)
        .json({ message: "Chat not found or not authorized" });
    }
    await prisma.chat.delete({ where: { id: req.params.id } });
    res.status(200).json({ message: "Chat deleted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to delete chat", error: error.message });
  }
};

const uploadDocumentAndTriggerWorkflow = async (req, res) => {
  const { chatId } = req.params;

  if (!req.file) {
    return res.status(400).json({ message: "No file was uploaded." });
  }

  try {
    const chat = await prisma.chat.findFirst({
      where: { id: chatId, userId: req.user.id },
    });
    if (!chat) {
      return res
        .status(404)
        .json({ message: "Chat not found or user is not authorized." });
    }

    const base64Content = req.file.buffer.toString("base64");

    const document = await prisma.document.create({
      data: {
        fileName: req.file.originalname,
        filePath: "in-memory",
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        chatId: chatId,
        userId: req.user.id,
      },
    });

    await axios.post(`${AI_SERVICE_URL}/process-document`, {
      file_name: req.file.originalname,
      file_content_base64: base64Content,
      chat_id: chatId,
    });

    res.status(201).json({
      message: "File uploaded and sent for processing successfully.",
      document,
    });
  } catch (error) {
    const errorMessage =
      error.response?.data?.detail ||
      "Failed to contact AI service or process document.";
    res.status(500).json({ message: errorMessage });
  }
};

const addMessage = async (req, res) => {
  const { chatId } = req.params;
  const { text, shouldRenameChat } = req.body;

  if (!text) {
    return res.status(400).json({ message: "Message text cannot be empty." });
  }

  try {
    const chat = await prisma.chat.findFirst({
      where: { id: chatId, userId: req.user.id },
    });
    if (!chat) return res.status(404).json({ message: "Chat not found" });

    if (shouldRenameChat) {
      try {
        const newTitle =
          text.substring(0, 40) + (text.length > 40 ? "..." : "");
        await prisma.chat.update({
          where: { id: chatId, userId: req.user.id },
          data: { title: newTitle },
        });
      } catch (e) {
        console.error("Could not rename chat:", e.message);
      }
    }

    const recentMessages = await prisma.message.findMany({
      where: { chatId },
      orderBy: { timestamp: "desc" },
      take: 6,
    });
    const historyForAI = recentMessages
      .reverse()
      .map((msg) => ({ role: msg.sender, content: msg.text }));

    const userMessage = await prisma.message.create({
      data: { text, sender: "user", chatId },
    });

    axios
      .post(`${AI_SERVICE_URL}/answer-query`, {
        query_text: text,
        chat_id: chatId,
        history: historyForAI,
      })
      .then(async (response) => {
        const { answer, tokens_used } = response.data;
        await prisma.message.create({
          data: {
            text: answer,
            sender: "assistant",
            chatId,
            tokensUsed: tokens_used || 0,
          },
        });
      })
      .catch(async (error) => {
        console.error("Error calling AI service for query:", error.message);
        await prisma.message.create({
          data: {
            text: "Sorry, the AI assistant is unavailable right now. Please try again later.",
            sender: "assistant",
            chatId,
          },
        });
      });

    res.status(201).json(userMessage);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to add message", error: error.message });
  }
};

const updateTitle = async (req, res) => {
  const { id } = req.params;
  const { title } = req.body;

  if (!title) {
    return res.status(400).json({ message: "Title is required." });
  }
  try {
    const chat = await prisma.chat.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!chat) {
      return res
        .status(404)
        .json({ message: "Chat not found or not authorized" });
    }

    const updatedChat = await prisma.chat.update({
      where: { id },
      data: { title },
    });

    res.status(200).json(updatedChat);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to update chat title", error: error.message });
  }
};

module.exports = {
  getChats,
  createChat,
  getChatById,
  deleteChat,
  addMessage,
  updateTitle,
  uploadDocumentAndTriggerWorkflow,
};
