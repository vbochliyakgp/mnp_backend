// middleware/auth.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { PrismaClient } from "../../generated/prisma";
import { ApiError } from "../utils/apiError";

const prisma = new PrismaClient();

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      throw new ApiError(401, "Access token is required");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { permissions: true },
    });

    if (!user || user.status !== "ACTIVE") {
      throw new ApiError(401, "Invalid token or inactive user");
    }

    (req as any).userId = user.id;
    (req as any).userPages = user.permissions.map(p => p.page);
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new ApiError(401, "Invalid token"));
    } else {
      next(error);
    }
  }
};

export const requirePageAccess = (page: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userPages = (req as any).userPages as string[];

      if (!userPages || !userPages.includes(page)) {
        throw new ApiError(403, `Access denied. You need permission to access ${page} page`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Check if user has admin page access
export const requireAdminAccess = (req: Request, res: Response, next: NextFunction) => {
  try {
    const userPages = (req as any).userPages as string[];

    if (!userPages || !userPages.includes("admin")) {
      throw new ApiError(403, "Admin access required");
    }

    next();
  } catch (error) {
    next(error);
  }
};
