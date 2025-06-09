import s3 from "../utils/r2Client.js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function uploadFile(req, res) {
  const file = req.file;
  const chatId = parseInt(req.params.id, 10);
  const userId = req.userId;

  if (!file || !chatId) {
    return res.status(400).json({ error: "File and chatId are required" });
  }

  // Verify chat belongs to user
  const chat = await prisma.chat.findFirst({
    where: { id: chatId, userId },
  });
  if (!chat) {
    return res.status(403).json({ error: "Chat not found or unauthorized" });
  }

  const key = `${userId}/${chatId}/${Date.now()}_${file.originalname}`;

  const params = {
    Bucket: process.env.R2_BUCKET,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
  };

  try {
    const { Location } = await s3.upload(params).promise();

    const document = await prisma.document.create({
      data: {
        chatId,
        name: file.originalname,
        filePath: Location,
        size: file.size,
        type: file.mimetype,
        uploadedAt: new Date(),
        processed: false, // Will be set to true when AI processes it
      },
    });

    // Update chat timestamp
    await prisma.chat.update({
      where: { id: chatId },
      data: { updatedAt: new Date() },
    });

    res.status(200).json({
      id: document.id,
      url: Location,
      key,
      name: document.name,
      type: document.type,
      size: document.size,
    });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Upload failed" });
  }
}
