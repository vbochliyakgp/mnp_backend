import { Response, NextFunction, RequestHandler } from "express";
import { AuthRequest } from "../types";
import { verifyAccessToken } from "../utils/jwt";

export const authenticateToken: RequestHandler = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    res.status(401).json({ message: "Access token required" });
    return;
  }

  try {
    const decoded = verifyAccessToken(token);
    req.user = decoded as {
      id: string;
      userId: string;
      email: string;
      role: string;
    };
    next();
  } catch (error) {
    res.status(403).json({ message: "Invalid or expired token" });
    return;
  }
};

export const authorizeRoles = (...roles: string[]): RequestHandler => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ message: "Insufficient permissions" });
      return;
    }
    next();
  };
};

// Add route parameter validation middleware
export const validateRouteParams: RequestHandler = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const params = req.params;
  for (const [key, value] of Object.entries(params)) {
    if (value.includes("://") || value.includes(".")) {
      res.status(400).json({
        message: "Invalid route parameter format",
        details: `Parameter '${key}' contains invalid characters`,
      });
      return;
    }
  }
  next();
};
