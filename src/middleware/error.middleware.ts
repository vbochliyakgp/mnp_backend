import { Request, Response, NextFunction } from "express";
import { CustomError } from "../utils/error";

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof CustomError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      details: err.details,
    });
  }

  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: "Internal Server Error",
  });
};
