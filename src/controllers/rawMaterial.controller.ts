import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "../../generated/prisma";
import { ApiError } from "../utils/apiError";
import { successResponse } from "../utils/apiResponse";
const prisma = new PrismaClient();

export const createRawMaterial = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { itemId, name, category, stock, price, reorderLevel } = req.body;

    const existingMaterial = await prisma.rawMaterial.findUnique({
      where: { itemId },
    });

    if (existingMaterial) {
      throw new ApiError(400, "Raw material with this item ID already exists");
    }

    const rawMaterial = await prisma.rawMaterial.create({
      data: {
        itemId,
        name,
        category,
        stock,
        price,
        reorderLevel,
      },
    });

    successResponse(res, 201, rawMaterial, "Raw material created successfully");
  } catch (error) {
    next(error);
  }
};

export const getRawMaterials = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { status, search } = req.query;

    const where: any = {};
    if (status) where.status = status;
    if (search) where.name = { contains: search as string };

    const rawMaterials = await prisma.rawMaterial.findMany({
      where,
      orderBy: {
        name: "asc",
      },
    });

    successResponse(
      res,
      200,
      rawMaterials,
      "Raw materials retrieved successfully"
    );
  } catch (error) {
    next(error);
  }
};

export const updateRawMaterialStock = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { stock } = req.body;

    // Determine status based on stock and reorder level
    const material = await prisma.rawMaterial.findUnique({ where: { id } });
    if (!material) throw new ApiError(404, "Raw material not found");

    let status: "IN_STOCK" | "OUT_OF_STOCK" | "LOW_STOCK" = "IN_STOCK";
    if (stock <= 0) {
      status = "OUT_OF_STOCK";
    } else if (material.reorderLevel && stock <= material.reorderLevel) {
      status = "LOW_STOCK";
    }

    const updatedMaterial = await prisma.rawMaterial.update({
      where: { id },
      data: { stock, status },
    });

    successResponse(
      res,
      200,
      updatedMaterial,
      "Raw material stock updated successfully"
    );
  } catch (error) {
    next(error);
  }
};
