import { Request, Response, NextFunction } from "express";
import { prisma } from "../utils/prisma";
import { ApiError } from "../utils/apiError";
import { successResponse } from "../utils/apiResponse";

export const createProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { itemId, name, category, price, materials } = req.body;

    const existingProduct = await prisma.product.findUnique({
      where: { itemId },
    });

    if (existingProduct) {
      throw new ApiError(400, "Product with this item ID already exists");
    }

    const product = await prisma.product.create({
      data: {
        itemId,
        name,
        category,
        price,
        materials: {
          create: materials.map((material: any) => ({
            rawMaterialId: material.rawMaterialId,
            quantity: material.quantity,
          })),
        },
      },
      include: {
        materials: {
          include: {
            rawMaterial: true,
          },
        },
      },
    });

    successResponse(res, 201, product, "Product created successfully");
  } catch (error) {
    next(error);
  }
};

export const getProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { category, search } = req.query;

    const where: any = {};
    if (category) where.category = category;
    if (search) where.name = { contains: search as string };

    const products = await prisma.product.findMany({
      where,
      include: {
        materials: {
          include: {
            rawMaterial: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    successResponse(res, 200, products, "Products retrieved successfully");
  } catch (error) {
    next(error);
  }
};

export const updateProductStock = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { stock } = req.body;

    const product = await prisma.product.update({
      where: { id },
      data: { stock },
    });

    successResponse(res, 200, product, "Product stock updated successfully");
  } catch (error) {
    next(error);
  }
};
