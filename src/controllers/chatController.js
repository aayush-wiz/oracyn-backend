const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const axios = require("axios");

// This URL must be correct for your setup.
// If you are running all services locally, localhost is correct.
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

// @desc    Get all chats for the logged-in user
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

// @desc    Create a new chat
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
      include: {
        messages: true, // to check if chat is empty
      },
    });

    // Check if a chat with the same title already exists
    const hasDuplicateTitle = chats.some((chat) => chat.title === title);
    if (hasDuplicateTitle) {
      return res
        .status(400)
        .json({ message: "A chat with this title already exists." });
    }

    // Check if the user already has an empty chat
    const hasEmptyChat = chats.some((chat) => chat.messages.length === 0);
    if (hasEmptyChat) {
      return res
        .status(400)
        .json({ message: "You already have an empty chat." });
    }

    const newChat = await prisma.chat.create({
      data: {
        title,
        userId: req.user.id,
      },
    });

    return res.status(201).json(newChat);
  } catch (error) {
    console.error("Failed to create chat:", error);
    return res
      .status(500)
      .json({ message: "Failed to create chat", error: error.message });
  }
};

// @desc    Get a single chat by ID, including its messages and documents
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

// @desc    Delete a chat by ID
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

// @desc    Upload a document using memory storage and trigger AI processing
const uploadDocumentAndTriggerWorkflow = async (req, res) => {
  const { chatId } = req.params;

  if (!req.file) {
    return res.status(400).json({ message: "No file was uploaded." });
  }

  try {
    // 1. Verify chat exists and user has access.
    const chat = await prisma.chat.findFirst({
      where: { id: chatId, userId: req.user.id },
    });
    if (!chat) {
      return res
        .status(404)
        .json({ message: "Chat not found or user is not authorized." });
    }

    // 2. The file is in memory at `req.file.buffer`. Convert to Base64.
    const base64Content = req.file.buffer.toString("base64");

    // 3. Save document metadata to our database.
    const document = await prisma.document.create({
      data: {
        fileName: req.file.originalname,
        filePath: "in-memory", // No longer a physical path
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        chatId: chatId,
        userId: req.user.id,
      },
    });

    // 4. Send the file content directly to the AI service.
    await axios.post(`${AI_SERVICE_URL}/process-document`, {
      file_name: req.file.originalname,
      file_content_base64: base64Content,
      chat_id: chatId,
    });

    console.log(`Successfully sent document for chat ${chatId} to AI service.`);

    // 5. Respond to the frontend with success.
    res.status(201).json({
      message: "File uploaded and sent for processing successfully.",
      document,
    });
  } catch (error) {
    console.error(
      "Error in uploadDocumentAndTriggerWorkflow:",
      error.response ? error.response.data : error.message
    );
    const errorMessage =
      error.response?.data?.detail ||
      "Failed to contact AI service or process document.";
    res.status(500).json({ message: errorMessage });
  }
};

// @desc    Add a message, include chat history, and get AI response
const addMessage = async (req, res) => {
  const { chatId } = req.params;
  const { text, shouldRenameChat } = req.body;

  if (!text) {
    return res.status(400).json({ message: "Message text cannot be empty." });
  }

  // If this is the first message, rename the chat based on the message content.
  if (shouldRenameChat) {
    try {
      const newTitle = text.substring(0, 40) + (text.length > 40 ? "..." : "");
      await prisma.chat.update({
        where: { id: chatId, userId: req.user.id },
        data: { title: newTitle },
      });
      console.log(`Renamed chat ${chatId} to "${newTitle}"`);
    } catch (e) {
      console.error("Could not rename chat:", e.message);
      // Non-critical error, so we don't stop the request flow.
    }
  }

  try {
    const chat = await prisma.chat.findFirst({
      where: { id: chatId, userId: req.user.id },
    });
    if (!chat) return res.status(404).json({ message: "Chat not found" });

    // Send recent message history to AI for better context
    const recentMessages = await prisma.message.findMany({
      where: { chatId },
      orderBy: { timestamp: "desc" },
      take: 6,
    });
    const historyForAI = recentMessages
      .reverse()
      .map((msg) => ({ role: msg.sender, content: msg.text }));

    // Save the user's new message to the database
    const userMessage = await prisma.message.create({
      data: { text, sender: "user", chatId },
    });

    // Asynchronously call the AI service without making the user wait
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

    // Respond immediately to the frontend with the user's message
    res.status(201).json(userMessage);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to add message", error: error.message });
  }
};

// @desc    Update the title of a chat
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
