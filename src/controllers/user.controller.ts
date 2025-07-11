import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "../../generated/prisma";
import { ApiError } from "../utils/apiError";
import { successResponse } from "../utils/apiResponse";
import bcrypt from "bcrypt";
import jwt, { SignOptions } from "jsonwebtoken";

const prisma = new PrismaClient();

const AVAILABLE_PAGES = [
  "dashboard",
  "orders", 
  "order-book",
  "inventory",
  "dispatch",
  "admin"
];

const generateToken = (userId: string) => {
  const secret = process.env.JWT_SECRET;
  const expiresIn = process.env.JWT_EXPIRES_IN || "7d";

  if (!secret) {
    throw new Error("JWT_SECRET is not defined in environment variables.");
  }

  const options: SignOptions = {
    expiresIn: "7d",
  };

  return jwt.sign({ userId }, secret, options);
};

const validatePages = (pages: string[]) => {
  if (!Array.isArray(pages)) {
    throw new ApiError(400, "Pages must be an array");
  }

  for (const page of pages) {
    if (!AVAILABLE_PAGES.includes(page)) {
      throw new ApiError(400, `Invalid page: ${page}. Available pages: ${AVAILABLE_PAGES.join(", ")}`);
    }
  }

  const uniquePages = [...new Set(pages)];
  if (pages.length !== uniquePages.length) {
    throw new ApiError(400, "Duplicate pages are not allowed");
  }
};

// Login user
export const loginUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new ApiError(400, "Email and password are required");
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { permissions: true },
    });

    if (!user) {
      throw new ApiError(401, "Invalid email or password");
    }

    if (user.status !== "ACTIVE") {
      throw new ApiError(401, "Account is not active");
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      throw new ApiError(401, "Invalid email or password");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const token = generateToken(user.id);
    const { password: _, ...userWithoutPassword } = user;

    successResponse(res, 200, {
      user: userWithoutPassword,
      token,
    }, "Login successful");
  } catch (error) {
    next(error);
  }
};

// Create user
export const createUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name, email, password, pages = [] } = req.body;

    if (!name || !email || !password) {
      throw new ApiError(400, "Name, email, and password are required");
    }

    if (password.length < 6) {
      throw new ApiError(400, "Password must be at least 6 characters long");
    }

    if (pages.length > 0) {
      validatePages(pages);
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ApiError(400, "User with this email already exists");
    }

    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user with permissions
    const result = await prisma.$transaction(async (prisma) => {
      const user = await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
        },
      });

      // Create page permissions
      if (pages.length > 0) {
        await prisma.userPermission.createMany({
          data: pages.map((page: string) => ({
            userId: user.id,
            page: page,
          })),
        });
      }

      return await prisma.user.findUnique({
        where: { id: user.id },
        include: { 
          permissions: {
            orderBy: { page: 'asc' }
          }
        },
      });
    });

    const { password: _, ...userWithoutPassword } = result!;

    successResponse(res, 201, userWithoutPassword, "User created with permissions successfully");
  } catch (error) {
    next(error);
  }
};

// Update user with page permissions
export const updateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { name, email, status, pages } = req.body;

    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      throw new ApiError(404, "User not found");
    }

    // Validate pages if provided
    if (pages !== undefined) {
      validatePages(pages);
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (status !== undefined) updateData.status = status;

    const result = await prisma.$transaction(async (prisma) => {
      // Update user basic info
      const updatedUser = await prisma.user.update({
        where: { id },
        data: updateData,
      });

      // Update permissions if provided
      if (pages !== undefined) {
        // Delete all existing permissions
        await prisma.userPermission.deleteMany({
          where: { userId: id },
        });

        // Create new permissions
        if (pages.length > 0) {
          await prisma.userPermission.createMany({
            data: pages.map((page: string) => ({
              userId: id,
              page: page,
            })),
          });
        }
      }

      return await prisma.user.findUnique({
        where: { id },
        include: { 
          permissions: {
            orderBy: { page: 'asc' }
          }
        },
      });
    });

    const { password: _, ...userWithoutPassword } = result!;

    successResponse(res, 200, userWithoutPassword, "User updated successfully");
  } catch (error) {
    next(error);
  }
};

// Get current user's permissions
export const getMyPermissions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req as any).userId;

    const permissions = await prisma.userPermission.findMany({
      where: { userId },
      orderBy: { page: 'asc' },
    });

    const allowedPages = permissions.map(p => p.page);

    const result = {
      permissions,
      allowedPages,
      availablePages: AVAILABLE_PAGES,
    };

    successResponse(res, 200, result, "User permissions retrieved successfully");
  } catch (error) {
    next(error);
  }
};

// Get all users with permissions
export const getUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: {
        createdAt: "desc",
      },
      include: {
        permissions: {
          orderBy: { page: 'asc' }
        },
      },
    });

    const usersWithoutPasswords = users.map(({ password, ...user }) => user);

    successResponse(res, 200, usersWithoutPasswords, "Users retrieved successfully");
  } catch (error) {
    next(error);
  }
};

// Get single user with permissions
export const getUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      include: { 
        permissions: {
          orderBy: { page: 'asc' }
        }
      },
    });

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const { password: _, ...userWithoutPassword } = user;

    successResponse(res, 200, userWithoutPassword, "User retrieved successfully");
  } catch (error) {
    next(error);
  }
};

// Update user status
export const updateUserStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const user = await prisma.user.update({
      where: { id },
      data: { status },
      include: { permissions: true },
    });

    const { password: _, ...userWithoutPassword } = user;

    successResponse(res, 200, userWithoutPassword, "User status updated successfully");
  } catch (error) {
    next(error);
  }
};

// Get current user profile
export const getCurrentUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req as any).userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { permissions: true },
    });

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const { password: _, ...userWithoutPassword } = user;

    successResponse(res, 200, userWithoutPassword, "User profile retrieved successfully");
  } catch (error) {
    next(error);
  }
};

// Change password
export const changePassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req as any).userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      throw new ApiError(400, "Current password and new password are required");
    }

    if (newPassword.length < 6) {
      throw new ApiError(400, "New password must be at least 6 characters long");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const isValidPassword = await bcrypt.compare(currentPassword, user.password);

    if (!isValidPassword) {
      throw new ApiError(400, "Current password is incorrect");
    }

    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword },
    });

    successResponse(res, 200, null, "Password changed successfully");
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id },
    });
    if(!user) {
      throw new ApiError(404, "User not found");
    }
    await prisma.user.delete({
      where: { id },
    });
    successResponse(res, 200, null, "User deleted successfully");
  } catch (error) {
    next(error);
  }
};