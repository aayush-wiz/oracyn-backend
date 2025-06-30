const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const axios = require("axios");

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

// Helper function to safely parse JSON data from the DB
const parseChart = (chart) => {
  try {
    return {
      ...chart,
      data: JSON.parse(chart.data),
      config: JSON.parse(chart.config),
    };
  } catch (e) {
    console.error(`Failed to parse chart data for chart ID: ${chart.id}`);
    return { ...chart, data: {}, config: {} };
  }
};

// --- CONTROLLER FUNCTIONS ---

// @desc    Get all charts belonging to the logged-in user
const getAllChartsForUser = async (req, res) => {
  try {
    const charts = await prisma.chart.findMany({
      where: { userId: req.user.id },
      // THIS IS THE FIX: Select both the id and the title of the related chat.
      include: { chat: { select: { id: true, title: true } } },
      orderBy: { createdAt: "desc" },
    });
    // The `parseChart` function doesn't need to change.
    res.status(200).json(charts.map(parseChart));
  } catch (error) {
    res.status(500).json({ message: "Failed to retrieve user's charts." });
  }
};

// @desc    Get all charts for a specific chat
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

// @desc    Get a single chart by its ID
const getChartById = async (req, res) => {
  try {
    const chart = await prisma.chart.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: {
        messages: { orderBy: { timestamp: "asc" } },
        documents: true,
        charts: { orderBy: { createdAt: "asc" } }, // This line was missing or incorrect.
      },
    });

    if (!chat) {
      return res
        .status(404)
        .json({ message: "Chat not found or not authorized" });
    }

    // IMPORTANT: If charts are found, we must parse their data strings into JSON.
    if (chat.charts && chat.charts.length > 0) {
      chat.charts = chat.charts.map(parseChart);
    }

    res.status(200).json(chat);
  } catch (error) {
    console.error("Error in getChatById:", error);
    res
      .status(500)
      .json({ message: "Failed to retrieve chat", error: error.message });
  }
};

// @desc    Create a new chart for a given chat
const createChart = async (req, res) => {
  const { chatId, prompt, chartType, label } = req.body;
  if (!chatId || !prompt || !chartType) {
    return res.status(400).json({
      message: "Missing required fields (chatId, prompt, chartType).",
    });
  }

  try {
    // Verify the user has access to the specified chat
    const chat = await prisma.chat.findFirst({
      where: {
        // ###############################################################
        // # THIS IS THE FIX.                                            #
        // # The 'chatId' is now passed directly as a string,            #
        // # which resolves the `PrismaClientValidationError`.           #
        // ###############################################################
        id: chatId,
        userId: req.user.id,
      },
    });

    if (!chat) {
      return res
        .status(404)
        .json({ message: "Chat not found or user is not authorized." });
    }

    // Call the AI service to generate the chart data
    const aiResponse = await axios.post(
      `${AI_SERVICE_URL}/generate-chart`,
      { prompt, chat_id: chatId, chart_type: chartType },
      { timeout: 45000 }
    );

    const { chart_json, tokens_used } = aiResponse.data;

    if (!chart_json || chart_json.error || !chart_json.data) {
      const errorMessage =
        chart_json?.error || "AI service returned invalid or empty chart data.";
      return res.status(400).json({ message: errorMessage });
    }

    // Save the new chart to the database
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

    console.log(`Successfully created chart ${newChart.id} in database.`);
    res.status(201).json(parseChart(newChart));
  } catch (error) {
    console.error("Error in createChart controller:", error);
    const errorMessage =
      error.response?.data?.detail || "An unexpected error occurred.";
    res.status(500).json({ message: errorMessage });
  }
};

// @desc    Delete a chart by its ID
const deleteChart = async (req, res) => {
  try {
    const chart = await prisma.chart.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!chart)
      return res
        .status(404)
        .json({ message: "Chart not found or not authorized." });
    await prisma.chart.delete({ where: { id: req.params.id } });
    res.status(200).json({ message: "Chart deleted successfully." });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete chart." });
  }
};

// Make sure all functions are exported so the router can find them.
module.exports = {
  getAllChartsForUser,
  getChartsByChat,
  getChartById,
  createChart,
  deleteChart,
};
