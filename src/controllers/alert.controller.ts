import { Request, Response, NextFunction } from "express";
import { prisma } from "../utils/prisma";
import { ApiError } from "../utils/apiError";
import { successResponse } from "../utils/apiResponse";

export const getAlerts = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { isRead, severity } = req.query;

    const where: any = {};
    if (isRead) where.isRead = isRead === "true";
    if (severity) where.severity = severity;

    const alerts = await prisma.alert.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
    });

    successResponse(res, 200, alerts, "Alerts retrieved successfully");
  } catch (error) {
    next(error);
  }
};

export const markAlertAsRead = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const alert = await prisma.alert.update({
      where: { id },
      data: { isRead: true },
    });

    successResponse(res, 200, alert, "Alert marked as read");
  } catch (error) {
    next(error);
  }
};

export const createLowStockAlert = async (material: any) => {
  await prisma.alert.create({
    data: {
      type: "STOCK_LOW",
      message: `Low stock alert for ${material.name}. Current stock: ${material.stock}`,
      severity: material.status === "OUT_OF_STOCK" ? "ERROR" : "WARNING",
    },
  });
};
