const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const fs = require("fs");
const axios = require("axios");

const AI_SERVICE_URL =
  process.env.AI_SERVICE_URL || "http://oracyn_ai_service:8000";

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

// @desc    Get a single chat by ID, including its messages and documents
const getChatById = async (req, res) => {
  try {
    const chat = await prisma.chat.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.id, // Security: Ensure user can only access their own chats
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
    // Prisma's onDelete: Cascade setting in the schema will handle deleting related messages, docs, etc.
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

// @desc    Upload a document and trigger processing via REST, waiting for completion
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

    // Wait for the AI service to confirm the document has been processed
    await axios.post(`${AI_SERVICE_URL}/process-document`, {
      document_path: document.filePath,
      chat_id: chatId,
    });

    console.log("Document processing completed successfully.");
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

// @desc    Add a message, include chat history, and get AI response
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

    // 1. Fetch recent chat history from the database
    const recentMessages = await prisma.message.findMany({
      where: { chatId: chatId },
      orderBy: { timestamp: "desc" },
      take: 6, // Get the last 6 messages for context
    });

    // Reverse the messages to be in chronological order and format them for the AI
    const historyForAI = recentMessages.reverse().map((msg) => ({
      role: msg.sender, // 'user' or 'assistant'
      content: msg.text,
    }));

    // 2. Save the new user message to our database
    const userMessage = await prisma.message.create({
      data: { text, sender: "user", chatId },
    });

    // 3. Asynchronously call the AI service with the new question and the history
    axios
      .post(`${AI_SERVICE_URL}/answer-query`, {
        query_text: text,
        chat_id: chatId,
        history: historyForAI, // <-- Send the history
      })
      .then(async (response) => {
        const aiAnswer = response.data.answer;
        // Save the AI's response to the database
        await prisma.message.create({
          data: { text: aiAnswer, sender: "assistant", chatId },
        });
      })
      .catch(async (error) => {
        console.error("Error calling AI service for query:", error.message);
        // Save an error message to the chat if the AI fails
        await prisma.message.create({
          data: {
            text: "Sorry, the AI assistant is currently unavailable.",
            sender: "assistant",
            chatId,
          },
        });
      });

    // 4. Respond to the user immediately with their own saved message
    res.status(201).json(userMessage);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to add message", error: error.message });
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
