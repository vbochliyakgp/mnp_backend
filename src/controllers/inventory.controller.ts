import { Request, Response, NextFunction } from "express";
import { prisma } from "../utils/prisma";
import { ApiError } from "../utils/apiError";
import { successResponse } from "../utils/apiResponse";

export const getInventorySummary = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const rawMaterials = await prisma.rawMaterial.findMany();
    const products = await prisma.product.findMany();

    const totalRawMaterials = rawMaterials.reduce(
      (sum, item) => sum + item.stock,
      0
    );
    const lowStockItems = [...rawMaterials, ...products].filter(
      (item) => item.status === "LOW_STOCK" || item.status === "OUT_OF_STOCK"
    ).length;

    const topSellingProduct = await prisma.product.findFirst({
      orderBy: { unitsSold: "desc" },
    });

    const finishedProducts = products.reduce(
      (sum, item) => sum + item.stock,
      0
    );

    successResponse(
      res,
      200,
      {
        totalRawMaterials,
        lowStockItems,
        topSellingProduct: topSellingProduct?.name,
        finishedProducts,
      },
      "Inventory summary retrieved successfully"
    );
  } catch (error) {
    next(error);
  }
};

export const getLowStockAlerts = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const rawMaterials = await prisma.rawMaterial.findMany({
      where: {
        OR: [{ status: "LOW_STOCK" }, { status: "OUT_OF_STOCK" }],
      },
    });

    const products = await prisma.product.findMany({
      where: {
        OR: [{ status: "LOW_STOCK" }, { status: "OUT_OF_STOCK" }],
      },
    });

    successResponse(
      res,
      200,
      [...rawMaterials, ...products],
      "Low stock alerts retrieved successfully"
    );
  } catch (error) {
    next(error);
  }
};

export const getTopSellingProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const products = await prisma.product.findMany({
      orderBy: { unitsSold: "desc" },
      take: 5,
    });

    successResponse(
      res,
      200,
      products,
      "Top selling products retrieved successfully"
    );
  } catch (error) {
    next(error);
  }
};
