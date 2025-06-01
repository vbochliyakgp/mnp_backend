import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "../../generated/prisma";
import { ApiError } from "../utils/apiError";
import { successResponse } from "../utils/apiResponse";
const prisma = new PrismaClient();

export const getSystemSettings = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const settings = await prisma.systemSettings.findMany();
    successResponse(
      res,
      200,
      settings,
      "System settings retrieved successfully"
    );
  } catch (error) {
    next(error);
  }
};

export const updateSystemSetting = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    const setting = await prisma.systemSettings.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });

    successResponse(res, 200, setting, "System setting updated successfully");
  } catch (error) {
    next(error);
  }
};
