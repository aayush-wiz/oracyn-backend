const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

exports.getStats = async (req, res) => {
  try {
    const userId = req.user.id;

    const [chatCount, documentCount, chartCount, messageTokens, chartTokens] =
      await Promise.all([
        prisma.chat.count({ where: { userId } }),
        prisma.document.count({ where: { userId } }),
        prisma.chart.count({ where: { userId } }),
        prisma.message.aggregate({
          where: { chat: { userId }, sender: "assistant" },
          _sum: { tokensUsed: true },
        }),
        prisma.chart.aggregate({
          where: { userId },
          _sum: { tokensUsed: true },
        }),
      ]);

    const totalTokensUsed =
      (messageTokens._sum.tokensUsed || 0) + (chartTokens._sum.tokensUsed || 0);

    res.status(200).json({
      chats: chatCount,
      documents: documentCount,
      charts: chartCount,
      tokensUsed: totalTokensUsed,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to retrieve user statistics." });
  }
};
