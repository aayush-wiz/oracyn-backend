const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// @desc    Get all charts for a specific chat
const getChartsByChat = async (req, res) => {
  try {
    const charts = await prisma.chart.findMany({
      where: {
        chatId: req.params.chatId,
        userId: req.user.id, // Security check
      },
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json(charts);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to retrieve charts", error: error.message });
  }
};

// @desc    Create a new chart
const createChart = async (req, res) => {
  const { chatId, type, label, data, config, createdFrom } = req.body;

  if (!chatId || !type || !label || !data) {
    return res.status(400).json({ message: "Missing required chart fields" });
  }

  try {
    // Ensure the chat belongs to the user before creating a chart in it
    const chat = await prisma.chat.findFirst({
      where: { id: chatId, userId: req.user.id },
    });
    if (!chat) {
      return res
        .status(404)
        .json({ message: "Chat not found or not authorized" });
    }

    const newChart = await prisma.chart.create({
      data: {
        type,
        label,
        data,
        config: config || {},
        createdFrom: createdFrom || "Unknown",
        chatId,
        userId: req.user.id,
      },
    });
    res.status(201).json(newChart);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to create chart", error: error.message });
  }
};

// @desc    Update a chart
const updateChart = async (req, res) => {
  const { id } = req.params;
  const { label, data, config } = req.body;

  try {
    const chart = await prisma.chart.findFirst({
      where: { id, userId: req.user.id },
    });

    if (!chart) {
      return res
        .status(404)
        .json({ message: "Chart not found or not authorized" });
    }

    const updatedChart = await prisma.chart.update({
      where: { id },
      data: {
        label,
        data,
        config,
      },
    });
    res.status(200).json(updatedChart);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to update chart", error: error.message });
  }
};

// @desc    Delete a chart
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
    res
      .status(500)
      .json({ message: "Failed to delete chart", error: error.message });
  }
};

module.exports = {
  getChartsByChat,
  createChart,
  updateChart,
  deleteChart,
};
