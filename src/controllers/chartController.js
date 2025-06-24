const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});
const axios = require("axios");

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://oracyn_ai_service:8000";

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
      error: error.message 
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
        userId: req.user.id 
      },
    });

    if (!chat) {
      return res.status(404).json({ 
        message: "Chat not found or not authorized" 
      });
    }

    // Call AI service to generate chart
    const aiResponse = await axios.post(
      `${AI_SERVICE_URL}/generate-chart`,
      {
        prompt,
        chat_id: chatId,
        chart_type: chartType,
      },
      { timeout: 30000 } // 30 second timeout
    );

    const chartJson = aiResponse.data?.chart_json;
    
    if (!chartJson || !chartJson.data) {
      throw new Error("AI service returned invalid or empty chart data.");
    }

    // Create the chart record
    const newChart = await prisma.chart.create({
      data: {
        type: chartJson.type || chartType,
        label: label,
        data: JSON.stringify(chartJson.data),
        config: JSON.stringify(chartJson.config || {}),
        createdFrom: "AI Generation",
        chatId: chatId,
        userId: req.user.id,
      },
    });

    console.log(`Successfully created chart ${newChart.id} in database.`);
    
    // Return the chart with parsed data for the frontend
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
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
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

module.exports = {
  getChartsByChat,
  createChart,
  deleteChart,
};
