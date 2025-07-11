const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const axios = require("axios");

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

const parseChart = (chart) => {
  try {
    return {
      ...chart,
      data: JSON.parse(chart.data),
      config: JSON.parse(chart.config),
    };
  } catch (e) {
    console.error(
      `Failed to parse chart data for chart ID: ${chart.id}`,
      e.message
    );
    return { ...chart, data: {}, config: {} };
  }
};

const getAllChartsForUser = async (req, res) => {
  try {
    const charts = await prisma.chart.findMany({
      where: { userId: req.user.id },
      include: { chat: { select: { id: true, title: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json(charts.map(parseChart));
  } catch (error) {
    res.status(500).json({ message: "Failed to retrieve user's charts." });
  }
};

const getChartsByChat = async (req, res) => {
  try {
    const charts = await prisma.chart.findMany({
      where: { chatId: req.params.chatId, userId: req.user.id },
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json(charts.map(parseChart));
  } catch (error) {
    res.status(500).json({ message: "Failed to retrieve chat charts." });
  }
};

const getChartById = async (req, res) => {
  try {
    const chart = await prisma.chart.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: { chat: { select: { id: true, title: true } } },
    });
    if (!chart) {
      return res
        .status(404)
        .json({ message: "Chart not found or not authorized" });
    }
    res.status(200).json(parseChart(chart));
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to retrieve chart", error: error.message });
  }
};

const createChart = async (req, res) => {
  const { chatId, prompt, chartType, label } = req.body;
  if (!chatId || !prompt || !chartType) {
    return res
      .status(400)
      .json({
        message: "Missing required fields (chatId, prompt, chartType).",
      });
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

    const aiResponse = await axios.post(`${AI_SERVICE_URL}/generate-chart`, {
      prompt,
      chat_id: chatId,
      chart_type: chartType,
    });

    const { chart_json, tokens_used } = aiResponse.data;

    if (!chart_json || chart_json.error || !chart_json.data) {
      const errorMessage =
        chart_json?.error || "AI service returned invalid or empty chart data.";
      return res.status(400).json({ message: errorMessage });
    }

    const newChart = await prisma.chart.create({
      data: {
        type: chart_json.type || chartType,
        label: label,
        data: JSON.stringify(chart_json.data),
        config: JSON.stringify(chart_json.config || {}),
        createdFrom: prompt,
        chatId: chatId,
        userId: req.user.id,
        tokensUsed: tokens_used || 0,
      },
    });

    res.status(201).json(parseChart(newChart));
  } catch (error) {
    const errorMessage =
      error.response?.data?.detail || "An unexpected error occurred.";
    res.status(500).json({ message: errorMessage });
  }
};

const deleteChart = async (req, res) => {
  try {
    const chart = await prisma.chart.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!chart) {
      return res
        .status(404)
        .json({ message: "Chart not found or not authorized." });
    }
    await prisma.chart.delete({ where: { id: req.params.id } });
    res.status(200).json({ message: "Chart deleted successfully." });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete chart." });
  }
};

module.exports = {
  getAllChartsForUser,
  getChartsByChat,
  getChartById,
  createChart,
  deleteChart,
};
