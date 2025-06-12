// backend/src/services/aiService.js
import axios from "axios";
import jwt from "jsonwebtoken";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";
const AI_SERVICE_TIMEOUT = parseInt(process.env.AI_SERVICE_TIMEOUT) || 30000;

// Create axios instance for AI service
const aiServiceClient = axios.create({
  baseURL: AI_SERVICE_URL,
  timeout: AI_SERVICE_TIMEOUT,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add request interceptor to include auth token
aiServiceClient.interceptors.request.use((config) => {
  // Create service token for internal communication
  const serviceToken = jwt.sign(
    { service: "backend", iat: Math.floor(Date.now() / 1000) },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  config.headers.Authorization = `Bearer ${serviceToken}`;
  return config;
});

// Add response interceptor for error handling
aiServiceClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("AI Service Error:", {
      url: error.config?.url,
      status: error.response?.status,
      message: error.response?.data?.error || error.message,
    });
    throw error;
  }
);

export const aiService = {
  // Process uploaded document
  async processDocument(documentData) {
    try {
      const response = await aiServiceClient.post(
        "/api/documents/process",
        documentData
      );
      return response.data;
    } catch (error) {
      throw new Error(
        `Document processing failed: ${
          error.response?.data?.error || error.message
        }`
      );
    }
  },

  // Delete document embeddings
  async deleteDocument(chatId, documentId) {
    try {
      const response = await aiServiceClient.delete(
        `/api/documents/${chatId}/${documentId}`
      );
      return response.data;
    } catch (error) {
      throw new Error(
        `Document deletion failed: ${
          error.response?.data?.error || error.message
        }`
      );
    }
  },

  // Process RAG query
  async processQuery(queryData) {
    try {
      const response = await aiServiceClient.post("/api/chat/query", queryData);
      return response.data;
    } catch (error) {
      throw new Error(
        `Query processing failed: ${
          error.response?.data?.error || error.message
        }`
      );
    }
  },

  // Generate chat summary
  async generateSummary(chatId) {
    try {
      const response = await aiServiceClient.post("/api/chat/summary", {
        chat_id: chatId,
      });
      return response.data;
    } catch (error) {
      throw new Error(
        `Summary generation failed: ${
          error.response?.data?.error || error.message
        }`
      );
    }
  },

  // Get document statistics
  async getDocumentStats(chatId) {
    try {
      const response = await aiServiceClient.get(
        `/api/documents/stats/${chatId}`
      );
      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to get document stats: ${
          error.response?.data?.error || error.message
        }`
      );
    }
  },

  // Get chat statistics
  async getChatStats(chatId) {
    try {
      const response = await aiServiceClient.get(`/api/chat/stats/${chatId}`);
      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to get chat stats: ${
          error.response?.data?.error || error.message
        }`
      );
    }
  },

  // Health check
  async healthCheck() {
    try {
      const response = await aiServiceClient.get("/health");
      return response.data;
    } catch (error) {
      return { status: "unhealthy", error: error.message };
    }
  },
};
