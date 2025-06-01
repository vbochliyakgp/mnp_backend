import { Request, Response, NextFunction } from "express";
import { prisma } from "../utils/prisma";
import { ApiError } from "../utils/apiError";
import { successResponse } from "../utils/apiResponse";
import { v4 as uuidv4 } from "uuid";

export const createProductionBatch = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { productId, quantity, orderId } = req.body;

    // Check product and raw material availability
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        materials: {
          include: {
            rawMaterial: true,
          },
        },
      },
    });

    if (!product) {
      throw new ApiError(404, "Product not found");
    }

    // Check raw material availability
    for (const material of product.materials) {
      if (material.rawMaterial.stock < material.quantity * quantity) {
        throw new ApiError(
          400,
          `Insufficient stock for ${material.rawMaterial.name}`
        );
      }
    }

    // Create production batch
    const batch = await prisma.productionBatch.create({
      data: {
        batchId: uuidv4(), // Generate a unique batchId using uuid
        product: { connect: { id: productId } },
        quantity,
        order: { connect: { id: orderId } },
      },
      include: {
        product: true,
        order: true,
      },
    });

    successResponse(res, 201, batch, "Production batch created successfully");
  } catch (error) {
    next(error);
  }
};

export const updateProductionStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const batch = await prisma.productionBatch.update({
      where: { id },
      data: { status },
    });

    // If production is completed, update product stock
    if (status === "COMPLETED") {
      await prisma.product.update({
        where: { id: batch.productId },
        data: {
          stock: { increment: batch.quantity },
        },
      });
    }

    successResponse(res, 200, batch, "Production status updated successfully");
  } catch (error) {
    next(error);
  }
};

export const getProductionSchedule = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { status } = req.query;

    const where: any = {};
    if (status) where.status = status;

    const batches = await prisma.productionBatch.findMany({
      where,
      include: {
        product: true,
        order: {
          include: {
            customer: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    successResponse(
      res,
      200,
      batches,
      "Production schedule retrieved successfully"
    );
  } catch (error) {
    next(error);
  }
};
