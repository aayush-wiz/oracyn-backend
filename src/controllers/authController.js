import pkg from "bcryptjs";
const { hash, compare } = pkg;
import jwt from "jsonwebtoken";
const { sign } = jwt;
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const signup = async (req, res) => {
  console.log("=== SIGNUP REQUEST ===");
  console.log("Request body:", req.body);
  console.log("Individual fields:", {
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    email: req.body.email,
    password: req.body.password ? "[PROVIDED]" : "[MISSING]",
  });

  const { firstName, lastName, email, password } = req.body;

  try {
    console.log("Checking existing user...");
    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      console.log("User already exists");
      return res.status(400).json({ message: "Email already exists" });
    }

    console.log("Hashing password...");
    const hashedPassword = await hash(password, 10);

    console.log("Creating user in database...");
    await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        password: hashedPassword,
      },
    });

    console.log("User created successfully");
    res.status(201).json({ message: "User created successfully" });
  } catch (error) {
    console.error("=== SIGNUP ERROR ===");
    console.error("Error details:", error);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    const isMatch = await compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    const token = sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
    res.json({ token });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

export default { signup, login };
