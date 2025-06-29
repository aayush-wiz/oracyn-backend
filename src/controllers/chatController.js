const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const fs = require("fs").promises; // Use the promise-based version of fs
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

// @desc    Upload a document and trigger processing by sending its content
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
      await fs.unlink(req.file.path); // Clean up the orphaned file
      return res
        .status(404)
        .json({ message: "Chat not found or not authorized" });
    }

    // 1. Read the file content that multer just saved
    const fileContent = await fs.readFile(req.file.path);
    // Encode the file content to Base64 to safely send it in JSON
    const base64Content = fileContent.toString("base64");

    // 2. Save document metadata to our database
    const document = await prisma.document.create({
      data: {
        fileName: req.file.originalname,
        filePath: req.file.path, // We can still save the original path for reference
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        chatId: chatId,
        userId: req.user.id,
      },
    });

    // 3. Send the file content directly to the AI service
    await axios.post(`${AI_SERVICE_URL}/process-document`, {
      file_name: req.file.originalname, // Send the original name
      file_content_base64: base64Content, // Send the encoded content
      chat_id: chatId,
    });

    // 4. Clean up the temporary file from the backend's storage
    await fs.unlink(req.file.path);

    console.log("Document content sent and processed successfully.");
    res
      .status(201)
      .json({ message: "File uploaded and processed successfully.", document });
  } catch (error) {
    console.error("Error in uploadDocumentAndTriggerWorkflow:", error.message);
    res.status(500).json({
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
    if (!chat) return res.status(404).json({ message: "Chat not found" });

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
        // Destructure the response to get both answer and tokens
        const { answer, tokens_used } = response.data;
        await prisma.message.create({
          data: {
            text: answer,
            sender: "assistant",
            chatId,
            // Save the token count with the AI's message
            tokensUsed: tokens_used || 0,
          },
        });
      })
      .catch(async (error) => {
        console.error("Error calling AI service for query:", error.message);
        await prisma.message.create({
          data: {
            text: "Sorry, the AI assistant is unavailable.",
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

module.exports = {
  getChats,
  createChat,
  getChatById,
  deleteChat,
  addMessage,
  uploadDocumentAndTriggerWorkflow,
};
