import type { Request, Response, NextFunction } from "express"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { validationResult } from "express-validator"
import dbConnection from "../database"
import { User } from "../database/models/User"
import { UserRole } from "../enums/UserRole"
import { generateRandomString, sendEmail } from "../utils/helper"
import { sendLoginInstructionsEmail } from "../utils/emailTemplates"

type ExpressHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>

// Helper function to exclude password from user object
const excludePassword = (user: User) => {
  const { password, ...userWithoutPassword } = user
  return userWithoutPassword
}

export class AuthController {
  // Register a new user
  static register: ExpressHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() })
        return
      }

      // Initialize database connection if not already initialized
      if (!dbConnection.isInitialized) {
        await dbConnection.initialize()
      }

      const userRepository = dbConnection.getRepository(User)

      // Extract user data from request body
      const { lastName, firstName, telephone, email, role = UserRole.EMPLOYEE } = req.body

      // Check if user with email already exists
      const existingUser = await userRepository.findOne({
        where: { email },
      })

      if (existingUser) {
        res.status(400).json({
          message: "Email already exists",
        })
        return
      }

      // Generate username
      const baseUsername = `${firstName} ${lastName}`;
      let username = baseUsername;
      let counter = 1;
      while (await userRepository.findOne({ where: { username } })) {
        username = `${baseUsername}${counter}`;
        counter++;
      }

      // Generate random password and hash it
      const password = generateRandomString(12)
      const hashedPassword = await bcrypt.hash(password, 12)

      // Create new user
      const user = userRepository.create({
        username,
        email,
        password: hashedPassword,
        telephone,
        firstName,
        lastName,
        role,
        isVerified: false,
        isFirstLogin: true,
        is2FAEnabled: false,
        otpAttempts: 0,
      })

      await userRepository.save(user)
      // Send login instructions
      await sendLoginInstructionsEmail(email, `${firstName} ${lastName}`, username, password);
        // Return success response
      res.status(201).json({
        success: true,
        message: "User registered successfully",
        data: {
          user: excludePassword(user),
        },
      })
    } catch (error: any) {
      console.error("Registration error:", error)
      res.status(500).json({
        message: "An error occurred while registering the user",
        error: process.env.NODE_ENV === "development" ? error.message : undefined,
      })
    }
  }

  // User login
  static login: ExpressHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() })
        return
      }

      const userRepository = dbConnection.getRepository(User)
      const { username, password } = req.body

      // Find user by username
      const user = await userRepository.findOne({
        where: { username },
      })

      // Check if user exists
      if (!user) {
        res.status(401).json({
          message: "Invalid credentials",
        })
        return
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password)
      if (!isValidPassword) {
        res.status(401).json({
          message: "Invalid credentials",
        })
        return
      }

      // Generate JWT token
      const token = jwt.sign(
        {
          userId: user.id,
          role: user.role,
        },
        process.env.JWT_SECRET || "your-secret-key",
        { expiresIn: "24h" },
      )

      // Return success response with token
      res.json({
        message: "Login successful",
        data: {
          user: excludePassword(user),
        },
        token,
      })
    } catch (error) {
      console.error("Login error:", error)
      next(error)
    }
  }

  // Change password
  static changePassword: ExpressHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() })
        return
      }

      const { currentPassword, newPassword } = req.body
      const userId = req.userId

      if (!userId) {
        res.status(401).json({ message: "Authentication required" })
        return
      }

      const userRepository = dbConnection.getRepository(User)
      const user = await userRepository.findOne({ where: { id: userId } })

      if (!user) {
        res.status(404).json({ message: "User not found" })
        return
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, user.password)
      if (!isValidPassword) {
        res.status(400).json({ message: "Current password is incorrect" })
        return
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 12)

      // Update user password
      user.password = hashedPassword
      user.isFirstLogin = false
      await userRepository.save(user)

      res.json({ message: "Password changed successfully" })
    } catch (error) {
      console.error("Change password error:", error)
      next(error)
    }
  }
}
