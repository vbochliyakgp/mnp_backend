import { Response } from "express";
import { AuthRequest } from "../types";
import { PrismaClient } from "../../generated/prisma/client";

const prisma = new PrismaClient();

export const getOrders = async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { orderId: { contains: search as string } },
        { customer: { name: { contains: search as string } } },
      ];
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
      orderBy: { createdAt: "desc" },
      skip,
      take: Number(limit),
    });

    const total = await prisma.order.count({ where });

    res.json({
      orders,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("Get orders error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const createOrder = async (req: AuthRequest, res: Response) => {
  try {
    const { customerId, items } = req.body;

    // Calculate total
    let total = 0;
    const orderItems = [];

    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
      });

      if (!product) {
        res
          .status(400)
          .json({ message: `Product not found: ${item.productId}` });
        return;
      }

      const itemTotal = product.price * item.quantity;
      total += itemTotal;

      orderItems.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: product.price,
        total: itemTotal,
      });
    }

    // Generate order ID
    const orderCount = await prisma.order.count();
    const orderId = `ORD${(orderCount + 1).toString().padStart(3, "0")}`;

    const order = await prisma.order.create({
      data: {
        orderId,
        customerId,
        userId: req.user?.id,
        total,
        items: {
          create: orderItems,
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

    res.status(201).json(order);
  } catch (error) {
    console.error("Create order error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
