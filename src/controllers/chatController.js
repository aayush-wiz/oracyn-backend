// =================================================================
// FILE: oracyn-backend/src/controllers/chatController.js (DEFINITIVE FIX)
// This version uses async/await to fix the race condition, ensuring
// the document is fully processed before the API returns a success message.
// =================================================================
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const fs = require("fs");
const axios = require("axios");

const AI_SERVICE_URL =
  process.env.AI_SERVICE_URL || "http://oracyn_ai_service:8000";

// --- Functions that do not need changes ---
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
    const newChat = await prisma.chat.create({
      data: {
        title,
        userId: req.user.id,
      },
    });
    res.status(201).json(newChat);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to create chat", error: error.message });
  }
};

const getChatById = async (req, res) => {
  try {
    const chat = await prisma.chat.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.id,
      },
      include: {
        messages: { orderBy: { timestamp: "asc" } },
        documents: true,
      },
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
      where: {
        id: req.params.id,
        userId: req.user.id,
      },
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

// === CORRECTED FUNCTIONS ===

// @desc    Add a message, get AI response via REST, and save both
const addMessage = async (req, res) => {
  const { chatId } = req.params;
  const { text } = req.body;

  try {
    const chat = await prisma.chat.findFirst({
      where: { id: chatId, userId: req.user.id },
    });
    if (!chat) {
      return res
        .status(404)
        .json({ message: "Chat not found or not authorized" });
    }

    // Save user message first
    const userMessage = await prisma.message.create({
      data: { text, sender: "user", chatId },
    });

    // Asynchronously call the AI service, but don't make the user wait
    axios
      .post(`${AI_SERVICE_URL}/answer-query`, {
        query_text: text,
        chat_id: chatId,
      })
      .then(async (response) => {
        const aiAnswer = response.data.answer;
        await prisma.message.create({
          data: { text: aiAnswer, sender: "assistant", chatId },
        });
      })
      .catch(async (error) => {
        console.error("Error calling AI service for query:", error.message);
        await prisma.message.create({
          data: {
            text: "Sorry, the AI assistant is currently unavailable.",
            sender: "assistant",
            chatId,
          },
        });
      });

    // Respond immediately with the user's message
    res.status(201).json(userMessage);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to add message", error: error.message });
  }
};

// @desc    Upload a document and trigger processing via REST
// THIS IS THE KEY FIX: The function now `await`s the AI service response.
const uploadDocumentAndTriggerWorkflow = async (req, res) => {
  const { chatId } = req.params;

  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded." });
  }

  try {
    const chat = await prisma.chat.findFirst({
      where: { id: chatId, userId: req.user.id },
    });
    if (!chat) {
      fs.unlinkSync(req.file.path);
      return res
        .status(404)
        .json({ message: "Chat not found or not authorized" });
    }

    const document = await prisma.document.create({
      data: {
        fileName: req.file.originalname,
        filePath: req.file.path,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        chatId: chatId,
        userId: req.user.id,
      },
    });

    // THIS IS THE FIX: Wait for the AI service to confirm completion
    await axios.post(`${AI_SERVICE_URL}/process-document`, {
      document_path: document.filePath,
      chat_id: chatId,
    });

    console.log("Document processing completed successfully.");
    // Now we can safely tell the user the file is ready
    res
      .status(201)
      .json({ message: "File uploaded and processed successfully.", document });
  } catch (error) {
    console.error("Error in uploadDocumentAndTriggerWorkflow:", error.message);
    res
      .status(500)
      .json({
        message: "Failed to upload or process document.",
        error: error.message,
      });
  }
};

module.exports = {
  getChats,
  createChat,
  getChatById,
  deleteChat,
  addMessage,
  uploadDocumentAndTriggerWorkflow,
};
