import { Request, Response, NextFunction } from "express";
import { prisma } from "../utils/prisma";
import { ApiError } from "../utils/apiError";
import { successResponse } from "../utils/apiResponse";
import { v4 as uuidv4 } from "uuid";

function generateUniqueId(): string {
  // implementation to generate a unique ID
  return uuidv4();
}

export const createDispatch = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { orderId, userId, customer, carrier, trackingId } = req.body;

    // Check if order exists and is completed
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!order) {
      throw new ApiError(404, "Order not found");
    }

    if (order.status !== "COMPLETED") {
      throw new ApiError(400, "Order must be completed before dispatch");
    }

    // Check product availability
    for (const item of order.items) {
      if (item.product.stock < item.quantity) {
        throw new ApiError(400, `Insufficient stock for ${item.product.name}`);
      }
    }

    // Create dispatch
    const dispatch = await prisma.dispatch.create({
      data: {
        dispatchId: generateUniqueId(), // Generate a unique ID for the dispatch
        order: {
          connect: {
            id: orderId,
          },
        },
        userId,
        customer,
        carrier,
        trackingId,
      },
      include: {
        order: true,
        user: true,
      },
    });
    // Update order status
    await prisma.order.update({
      where: { id: orderId },
      data: { status: "SHIPPED" },
    });

    // Update product stock
    for (const item of order.items) {
      await prisma.product.update({
        where: { id: item.productId },
        data: {
          stock: { decrement: item.quantity },
          unitsSold: { increment: item.quantity },
        },
      });
    }

    successResponse(res, 201, dispatch, "Dispatch created successfully");
  } catch (error) {
    next(error);
  }
};

export const updateDispatchStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const dispatch = await prisma.dispatch.update({
      where: { id },
      data: { status },
    });

    // If delivered, update order status
    if (status === "DELIVERED") {
      await prisma.order.update({
        where: { id: dispatch.orderId },
        data: { status: "DELIVERED" },
      });
    }

    successResponse(res, 200, dispatch, "Dispatch status updated successfully");
  } catch (error) {
    next(error);
  }
};

export const getDispatches = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { status } = req.query;

    const where: any = {};
    if (status) where.status = status;

    const dispatches = await prisma.dispatch.findMany({
      where,
      include: {
        order: {
          include: {
            customer: true,
          },
        },
        user: true,
      },
      orderBy: {
        date: "desc",
      },
    });

    successResponse(res, 200, dispatches, "Dispatches retrieved successfully");
  } catch (error) {
    next(error);
  }
};
