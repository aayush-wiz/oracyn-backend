import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const getProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { firstName: true, lastName: true, email: true },
    });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

const updateProfile = async (req, res) => {
  const { firstName, lastName } = req.body;
  try {
    await prisma.user.update({
      where: { id: req.userId },
      data: { firstName, lastName },
    });
    res.json({ message: "Profile updated successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

export default { getProfile, updateProfile };
