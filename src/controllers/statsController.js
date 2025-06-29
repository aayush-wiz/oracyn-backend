const prisma = require("../../lib/prisma.js");

/**
 * @desc    Get aggregated statistics for the logged-in user
 * @route   GET /api/stats
 * @access  Private
 */
exports.getStats = async (req, res) => {
  try {
    const userId = req.user.id; // From authMiddleware

    // --- REAL TOKEN TRACKING ---
    // 1. Get stats for chats, documents, and charts
    const [chatCount, documentCount, chartCount] = await Promise.all([
      prisma.chat.count({ where: { userId } }),
      prisma.document.count({ where: { userId } }),
      prisma.chart.count({ where: { userId } }),
    ]);

    // 2. Aggregate the token usage from both Messages and Charts
    const [messageTokens, chartTokens] = await Promise.all([
      prisma.message.aggregate({
        where: {
          chat: { userId: userId }, // Filter by the user who owns the chat
          sender: "assistant", // Only count tokens for AI responses
        },
        _sum: {
          tokensUsed: true,
        },
      }),
      prisma.chart.aggregate({
        where: { userId: userId }, // Filter by the user who owns the chart
        _sum: {
          tokensUsed: true,
        },
      }),
    ]);

    const totalTokensUsed =
      (messageTokens._sum.tokensUsed || 0) + (chartTokens._sum.tokensUsed || 0);

    // 3. Send the final, accurate statistics
    res.status(200).json({
      chats: chatCount,
      documents: documentCount,
      charts: chartCount,
      tokensUsed: totalTokensUsed,
    });
  } catch (error) {
    console.error("Error getting user stats:", error);
    res.status(500).json({ message: "Failed to retrieve user statistics." });
  }
};
