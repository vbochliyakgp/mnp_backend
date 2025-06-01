import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "../../generated/prisma";
import { ApiError } from "../utils/apiError";
import { successResponse } from "../utils/apiResponse";
const prisma = new PrismaClient();

export const createOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      customerId,
      userId,
      salesProcess,
      deliveryMethod,
      carrier,
      items,
      remarks,
    } = req.body;

    // Validate required fields
    if (!customerId || !items || items.length === 0) {
      throw new ApiError(400, "Customer and items are required");
    }

    // Calculate order total and validate items
    const products = await prisma.product.findMany({
      where: { id: { in: items.map((item: any) => item.productId) } },
    });

    const orderItems = items.map((item: any) => {
      const product = products.find((p) => p.id === item.productId);
      if (!product)
        throw new ApiError(404, `Product not found: ${item.productId}`);

      return {
        productId: item.productId,
        colorTop: item.colorTop,
        colorBottom: item.colorBottom,
        length: item.length,
        width: item.width,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: product.price,
        total: product.price * item.quantity,
      };
    });

    const total = orderItems.reduce(
      (sum: number, item: any) => sum + item.total,
      0
    );

    // Generate order ID
    const lastOrder = await prisma.order.findFirst({
      orderBy: { orderId: "desc" },
    });
    const nextId = lastOrder
      ? parseInt(lastOrder.orderId.replace("ORD", "")) + 1
      : 1;
    const orderId = `ORD${nextId.toString().padStart(3, "0")}`;

    // Create order
    const order = await prisma.order.create({
      data: {
        orderId,
        customerId,
        userId,
        salesProcess,
        deliveryMethod,
        carrier,
        total,
        remarks,
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
    const {
      status,
      customer,
      productType,
      startDate,
      endDate,
      page = 1,
      limit = 10,
    } = req.query;

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

    const [orders, totalCount] = await Promise.all([
      prisma.order.findMany({
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
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.order.count({ where }),
    ]);

    successResponse(
      res,
      200,
      {
        orders,
        pagination: {
          total: totalCount,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(totalCount / Number(limit)),
        },
      },
      "Orders retrieved successfully"
    );
  } catch (error) {
    next(error);
  }
};

export const getOrderBook = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { filter } = req.query;

    // Get counts for the dashboard header
    const [newOrdersCount, inProductionCount, completedCount] =
      await Promise.all([
        prisma.order.count({
          where: {
            createdAt: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)), // Today's date
            },
            status: "PENDING",
          },
        }),
        prisma.order.count({ where: { status: "IN_PRODUCTION" } }),
        prisma.order.count({ where: { status: "COMPLETED" } }),
      ]);

    // Build the where clause based on filter
    const where: any = {};
    if (filter === "In Production") where.status = "IN_PRODUCTION";
    if (filter === "Completed") where.status = "COMPLETED";

    // Get orders with their first product
    const orders = await prisma.order.findMany({
      where,
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
          take: 1, // Only get the first product for the list view
        },
      },
      orderBy: { date: "desc" },
      take: 5, // Default to 5 orders as shown in UI
    });

    // Format the orders to match the UI table
    const formattedOrders = orders.map((order) => ({
      orderId: order.orderId,
      customer: order.customer.company || order.customer.name,
      date: order.date.toISOString().split("T")[0], // Format as YYYY-MM-DD
      status: order.status.charAt(0) + order.status.slice(1).toLowerCase(), // Capitalize first letter
      product: order.items[0]?.product?.name || "Multiple Products",
    }));

    successResponse(
      res,
      200,
      {
        summary: {
          newOrders: newOrdersCount,
          inProduction: inProductionCount,
          completed: completedCount,
        },
        orders: formattedOrders,
        total: orders.length,
        showing: orders.length,
      },
      "Order book data retrieved successfully"
    );
  } catch (error) {
    next(error);
  }
};

export const getOrderDetails = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { orderId: id },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },

        dispatch: true,
      },
    });

    if (!order) {
      throw new ApiError(404, "Order not found");
    }

    // Format response to match UI
    const response = {
      orderId: order.orderId,
      customer: {
        name: order.customer.company || order.customer.name,
        date: order.date.toISOString().split("T")[0],
      },
      status: order.status,
      products: order.items.map((item) => ({
        name: item.product.name,
        length: item.length,
        width: item.width,
        quantity: item.quantity,
        unit: item.unit,
        colorTop: item.colorTop,
        colorBottom: item.colorBottom,
      })),

      dispatch: order.dispatch,
    };

    successResponse(res, 200, response, "Order details retrieved successfully");
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

    if (!status) {
      throw new ApiError(400, "Status is required");
    }

    const validStatuses = [
      "PENDING",
      "PROCESSING",
      "IN_PRODUCTION",
      "COMPLETED",
      "DELAYED",
    ];
    if (!validStatuses.includes(status)) {
      throw new ApiError(400, "Invalid status value");
    }

    const order = await prisma.order.update({
      where: { orderId: id },
      data: { status },
      include: {
        customer: true,
      },
    });

    successResponse(
      res,
      200,
      {
        orderId: order.orderId,
        status: order.status,
        customer: order.customer.company || order.customer.name,
      },
      "Order status updated successfully"
    );
  } catch (error) {
    next(error);
  }
};

export const updateOrderProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { products } = req.body;

    if (!products || !Array.isArray(products)) {
      throw new ApiError(400, "Products array is required");
    }

    // Validate each product
    for (const product of products) {
      if (
        !product.productId ||
        !product.quantity ||
        !product.length ||
        !product.width
      ) {
        throw new ApiError(
          400,
          "Each product must have productId, quantity, length, and width"
        );
      }
    }

    // Transaction to update order items
    const updatedOrder = await prisma.$transaction(async (prisma) => {
      // Delete existing items
      await prisma.orderItem.deleteMany({
        where: { order: { orderId: id } },
      });

      // Get products to calculate prices
      const productIds = products.map((p) => p.productId);
      const productRecords = await prisma.product.findMany({
        where: { id: { in: productIds } },
      });

      // Create new items
      const newItems = products.map((product) => {
        const productRecord = productRecords.find(
          (p) => p.id === product.productId
        );
        if (!productRecord) {
          throw new ApiError(404, `Product not found: ${product.productId}`);
        }

        return {
          productId: product.productId,
          colorTop: product.colorTop,
          colorBottom: product.colorBottom,
          length: product.length,
          width: product.width,
          quantity: product.quantity,
          unit: product.unit || "units",
          unitPrice: productRecord.price,
          total: productRecord.price * product.quantity,
        };
      });

      // Calculate new total
      const newTotal = newItems.reduce((sum, item) => sum + item.total, 0);

      // Update order with new items and total
      return await prisma.order.update({
        where: { orderId: id },
        data: {
          total: newTotal,
          items: {
            create: newItems,
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
    });

    successResponse(
      res,
      200,
      {
        orderId: updatedOrder.orderId,
        products: updatedOrder.items.map((item) => ({
          name: item.product.name,
          quantity: item.quantity,
          length: item.length,
          width: item.width,
          unit: item.unit,
        })),
      },
      "Order products updated successfully"
    );
  } catch (error) {
    next(error);
  }
};
