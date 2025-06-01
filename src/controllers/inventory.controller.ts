import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "../../generated/prisma";
import { ApiError } from "../utils/apiError";
import { successResponse } from "../utils/apiResponse";
const prisma = new PrismaClient();

export const getInventorySummary = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const [rawMaterials, products, lowStockItems, topSellingProduct] =
      await Promise.all([
        prisma.rawMaterial.findMany(),
        prisma.product.findMany(),
        prisma.rawMaterial.count({
          where: {
            OR: [{ status: "LOW_STOCK" }, { status: "OUT_OF_STOCK" }],
          },
        }),
        prisma.product.findFirst({
          orderBy: { unitsSold: "desc" },
        }),
      ]);

    const totalRawMaterials = rawMaterials.reduce(
      (sum, item) => sum + item.stock,
      0
    );
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

export const addRawMaterial = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name, supplier, quantity, unit, price, reorderLevel, remarks } =
      req.body;

    // Generate item ID
    const lastMaterial = await prisma.rawMaterial.findFirst({
      orderBy: { itemId: "desc" },
    });
    const nextId = lastMaterial
      ? parseInt(lastMaterial.itemId.replace("MAT", "")) + 1
      : 1;
    const itemId = `MAT${nextId.toString().padStart(3, "0")}`;

    const rawMaterial = await prisma.rawMaterial.create({
      data: {
        itemId,
        name,
        supplier,
        stock: parseFloat(quantity),
        unit,
        price: parseFloat(price),
        status:
          quantity > 0
            ? reorderLevel && quantity <= reorderLevel
              ? "LOW_STOCK"
              : "IN_STOCK"
            : "OUT_OF_STOCK",
        reorderLevel: reorderLevel ? parseFloat(reorderLevel) : null,
        remarks,
      },
    });

    successResponse(res, 201, rawMaterial, "Raw material added successfully");
  } catch (error) {
    next(error);
  }
};

export const addFinishedProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { type, name, width, quantity, unit, length, price, remarks } =
      req.body;

    // Generate item ID
    const lastProduct = await prisma.product.findFirst({
      orderBy: { itemId: "desc" },
    });
    const nextId = lastProduct
      ? parseInt(lastProduct.itemId.replace("PROD", "")) + 1
      : 1;
    const itemId = `PROD${nextId.toString().padStart(3, "0")}`;

    const product = await prisma.product.create({
      data: {
        itemId,
        name,
        type,
        width: parseFloat(width),
        stock: parseInt(quantity),
        unit,
        length: parseFloat(length),
        price: price ? parseFloat(price) : 0,
        status: quantity > 0 ? "IN_STOCK" : "OUT_OF_STOCK",
        remarks,
      },
    });

    successResponse(res, 201, product, "Finished product added successfully");
  } catch (error) {
    next(error);
  }
};

export const generateInventoryReport = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { category, status, startDate, endDate } = req.query;

    const where = {
      ...(category && category !== "All Categories" ? { category } : {}),
      ...(status && status !== "All Statuses" ? { status } : {}),
      ...(startDate && endDate
        ? {
            createdAt: {
              gte: new Date(startDate as string),
              lte: new Date(endDate as string),
            },
          }
        : {}),
    };

    const rawMaterials = await prisma.rawMaterial.findMany({
      orderBy: { name: "asc" },
    });

    const products = await prisma.product.findMany({
      orderBy: { name: "asc" },
    });

    successResponse(
      res,
      200,
      {
        rawMaterials,
        products,
      },
      "Inventory report generated successfully"
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
    const alerts = await prisma.rawMaterial.findMany({
      where: {
        OR: [{ status: "LOW_STOCK" }, { status: "OUT_OF_STOCK" }],
      },
      orderBy: { stock: "asc" },
    });

    successResponse(
      res,
      200,
      alerts,
      "Low stock alerts retrieved successfully"
    );
  } catch (error) {
    next(error);
  }
};
