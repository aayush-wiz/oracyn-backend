const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const axios = require("axios");

const AI_SERVICE_URL =
  process.env.AI_SERVICE_URL || "http://oracyn_ai_service:8000";

const parseChart = (chart) => {
  try {
    return {
      ...chart,
      data: JSON.parse(chart.data),
      config: JSON.parse(chart.config),
    };
  } catch (e) {
    console.error(`Failed to parse chart data for chart ID: ${chart.id}`);
    return { ...chart, data: {}, config: {} }; // Return a safe default
  }
};

const getChartsByChat = async (req, res) => {
  try {
    const charts = await prisma.chart.findMany({
      where: {
        chatId: req.params.chatId,
        userId: req.user.id,
      },
      orderBy: { createdAt: "desc" },
    });

    // Parse the string data back into JSON for the frontend
    const parsedCharts = charts.map((chart) => ({
      ...chart,
      data: JSON.parse(chart.data),
      config: JSON.parse(chart.config),
    }));
    res.status(200).json(parsedCharts);
  } catch (error) {
    console.error("Error in getChartsByChat:", error);
    res.status(500).json({
      message: "Failed to retrieve charts",
      error: error.message,
    });
  }
};

const createChart = async (req, res) => {
  const { chatId, prompt, chartType, label } = req.body;

  if (!chatId || !prompt || !chartType || !label) {
    return res.status(400).json({ message: "Missing required fields." });
  }

  try {
    // Verify chat exists and user has access
    const chat = await prisma.chat.findFirst({
      where: {
        id: chatId,
        userId: req.user.id,
      },
    });

    if (!chat) {
      return res.status(404).json({
        message: "Chat not found or not authorized",
      });
    }

    // Call AI service to generate chart
    const aiResponse = await axios.post(
      `${AI_SERVICE_URL}/generate-chart`,
      { prompt, chat_id: chatId, chart_type: chartType },
      { timeout: 30000 }
    );

    const { chart_json, tokens_used } = aiResponse.data;

    if (!chart_json || !chart_json.data) {
      throw new Error("AI service returned invalid or empty chart data.");
    }

    const newChart = await prisma.chart.create({
      data: {
        type: chart_json.type || chartType,
        label: label,
        data: JSON.stringify(chart_json.data),
        config: JSON.stringify(chart_json.config || {}),
        createdFrom: "AI Generation",
        chatId: chatId,
        userId: req.user.id,
        // Save the token count when creating the chart
        tokensUsed: tokens_used || 0,
      },
    });

    console.log(`Successfully created chart ${newChart.id} in database.`);
    res.status(201).json({
      ...newChart,
      data: JSON.parse(newChart.data),
      config: JSON.parse(newChart.config),
    });
  } catch (error) {
    console.error("Error in createChart controller:", error);

    const statusCode = error.response?.status || 500;
    const errorMessage = error.response?.data?.message || error.message;

    res.status(statusCode).json({
      message: "Failed to create chart",
      error: errorMessage,
      details: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

const deleteChart = async (req, res) => {
  const { id } = req.params;
  try {
    const chart = await prisma.chart.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!chart) {
      return res
        .status(404)
        .json({ message: "Chart not found or not authorized" });
    }
    await prisma.chart.delete({ where: { id } });
    res.status(200).json({ message: "Chart deleted successfully" });
  } catch (error) {
    console.error("Error in deleteChart:", error.message);
    res
      .status(500)
      .json({ message: "Failed to delete chart", error: error.message });
  }
};

const getChartById = async (req, res) => {
  try {
    const chart = await prisma.chart.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!chart) {
      return res
        .status(404)
        .json({ message: "Chart not found or not authorized" });
    }
    res.status(200).json(parseChart(chart));
  } catch (error) {
    console.error("Error in getChartById:", error);
    res.status(500).json({ message: "Failed to retrieve chart" });
  }
};

const getAllChartsForUser = async (req, res) => {
  try {
    const charts = await prisma.chart.findMany({
      where: { userId: req.user.id },
      include: { chat: { select: { title: true } } }, // Include chat title
      orderBy: { createdAt: "desc" },
    });
    const parsedCharts = charts.map(parseChart);
    res.status(200).json(parsedCharts);
  } catch (error) {
    console.error("Error in getAllChartsForUser:", error);
    res.status(500).json({ message: "Failed to retrieve charts" });
  }
};

module.exports = {
  getChartsByChat,
  createChart,
  deleteChart,
  getAllChartsForUser,
  getChartById,
};
