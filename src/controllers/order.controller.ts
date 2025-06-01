import { Request, Response, NextFunction } from "express";
import { prisma } from "../utils/prisma";
import { ApiError } from "../utils/apiError";
import { successResponse } from "../utils/apiResponse";

function generateOrderId(): string {
  return `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export const createOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { customerId, userId, items } = req.body;

    // Calculate total
    const products = await prisma.product.findMany({
      where: { id: { in: items.map((item: any) => item.productId) } },
    });

    const orderItems = items.map((item: any) => {
      const product = products.find((p) => p.id === item.productId);
      if (!product)
        throw new ApiError(404, `Product not found: ${item.productId}`);
      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: product.price,
        total: product.price * item.quantity,
      };
    });

    const total = orderItems.reduce(
      (sum: number, item: any) => sum + item.total,
      0
    );

    // Create order
    const order = await prisma.order.create({
      data: {
        orderId: generateOrderId(), // You need to generate a unique order ID
        customerId,
        userId,
        total,
        items: {
          create: orderItems,
        },
        customer: {
          connect: {
            id: customerId,
          },
        },
      },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    successResponse(res, 201, order, "Order created successfully");
  } catch (error) {
    next(error);
  }
};

export const getOrders = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { status, customer, productType, startDate, endDate } = req.query;

    const where: any = {};

    if (status) where.status = status;
    if (customer) where.customer = { name: { contains: customer as string } };
    if (productType) {
      where.items = {
        some: {
          product: {
            name: { contains: productType as string },
          },
        },
      };
    }
    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      };
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: {
        date: "desc",
      },
    });

    successResponse(res, 200, orders, "Orders retrieved successfully");
  } catch (error) {
    next(error);
  }
};

export const getOrderById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
        dispatch: true,
        production: true,
      },
    });

    if (!order) {
      throw new ApiError(404, "Order not found");
    }

    successResponse(res, 200, order, "Order retrieved successfully");
  } catch (error) {
    next(error);
  }
};

export const updateOrderStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const order = await prisma.order.update({
      where: { id },
      data: { status },
    });

    successResponse(res, 200, order, "Order status updated successfully");
  } catch (error) {
    next(error);
  }
};
