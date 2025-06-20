const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const fs = require("fs");
// Import our new gRPC client instead of using node-fetch
const grpcClient = require("../grpcClient");

// @desc    Get all chats for the logged-in user
const getChats = async (req, res) => {
  try {
    const chats = await prisma.chat.findMany({
      where: { userId: req.user.id },
      orderBy: { updatedAt: "desc" },
      include: {
        messages: {
          orderBy: { timestamp: "asc" },
          take: 1,
        },
      },
    });
    res.status(200).json(chats);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to retrieve chats", error: error.message });
  }
};

// @desc    Create a new chat
const createChat = async (req, res) => {
  const { title } = req.body;
  if (!title) {
    return res.status(400).json({ message: "Title is required" });
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

// @desc    Get a single chat by ID
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
        charts: true,
      },
    });

    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }
    res.status(200).json(chat);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to retrieve chat", error: error.message });
  }
};

// @desc    Delete a chat
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

    await prisma.chat.delete({
      where: { id: req.params.id },
    });

    res.status(200).json({ message: "Chat deleted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to delete chat", error: error.message });
  }
};

// === NEW gRPC IMPLEMENTATION ===

// @desc    Add a message, get AI response via gRPC, and save both
const addMessage = async (req, res) => {
  const { chatId } = req.params;
  const { text } = req.body;
  const sender = "user";

  if (!text) {
    return res.status(400).json({ message: "Message text is required" });
  }

  try {
    // 1. Verify chat exists and belongs to the user
    const chat = await prisma.chat.findFirst({
      where: { id: chatId, userId: req.user.id },
    });
    if (!chat) {
      return res
        .status(404)
        .json({ message: "Chat not found or not authorized" });
    }

    // 2. Save the user's message to the database
    const userMessage = await prisma.message.create({
      data: { text, sender, chatId },
    });

    // 3. Call the AI service via gRPC and handle the response in a callback
    grpcClient.AnswerQuery(
      { query_text: text, chat_id: chatId },
      async (error, response) => {
        if (error) {
          console.error("gRPC Error during AnswerQuery:", error.details);
          // Save an error message to the chat so the user knows something went wrong
          await prisma.message.create({
            data: {
              text: "Sorry, I encountered an error and could not generate a response.",
              sender: "assistant",
              chatId,
            },
          });
        } else {
          console.log("gRPC AI Response:", response.answer);
          // 4. Save the AI's successful response to the database
          await prisma.message.create({
            data: {
              text: response.answer,
              sender: "assistant",
              chatId,
            },
          });
        }
      }
    );

    // 5. IMPORTANT: Return the user's message to the frontend IMMEDIATELY.
    // The AI response is handled asynchronously in the background.
    res.status(201).json(userMessage);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to add message", error: error.message });
  }
};

// @desc    Upload a document and trigger processing via gRPC
const uploadDocumentAndTriggerWorkflow = async (req, res) => {
  const { chatId } = req.params;

  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded." });
  }

  try {
    // 1. Verify chat exists and belongs to the user
    const chat = await prisma.chat.findFirst({
      where: { id: chatId, userId: req.user.id },
    });
    if (!chat) {
      // Clean up the uploaded file if the chat is invalid
      fs.unlinkSync(req.file.path);
      return res
        .status(404)
        .json({ message: "Chat not found or not authorized" });
    }

    // 2. Save document metadata to the database
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

    // 3. Asynchronously trigger the AI service via gRPC to process the document
    // We don't wait for the response, it happens in the background.
    grpcClient.ProcessDocument(
      { document_path: document.filePath, chat_id: chatId },
      (error, response) => {
        if (error) {
          console.error("gRPC Error during ProcessDocument:", error.details);
        } else {
          console.log("gRPC document processing response:", response.message);
          // Here you could save a message to the chat like "I've finished reading your document"
        }
      }
    );

    res
      .status(201)
      .json({ message: "File uploaded. Processing has started.", document });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to upload document", error: error.message });
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
