import { Request, Response, NextFunction } from "express";
import { PrismaClient, Prisma } from "../../generated/prisma";
import { ApiError } from "../utils/apiError";
import { successResponse } from "../utils/apiResponse";

const prisma = new PrismaClient();

// Type definitions
type OrderStatus =
  | "PENDING"
  | "PROCESSING"
  | "IN_PRODUCTION"
  | "COMPLETED"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "DELAYED";
type ProductionStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "DELAYED";
type DispatchStatus =
  | "READY_FOR_PICKUP"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "DELAYED";

// WhatsApp Integration Functions

const cleanPhoneNumber = (phone: string | undefined) =>
  phone?.replace(/\D/g, "") || null;
export const getCustomerByWhatsApp = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { whatsapp } = req.params;
    const cleanWhatsapp = cleanPhoneNumber(whatsapp);

    const customer = await prisma.customer.findFirst({
      where: {
        customerPhone: {
          contains: cleanWhatsapp || "",
        },
      },
      orderBy: { createdAt: "desc" },
    });

    successResponse(
      res,
      200,
      {
        exists: !!customer,
        customer: customer || null,
      },
      customer ? "Customer found" : "No customer found"
    );
  } catch (error) {
    next(error);
  }
};

export const checkCustomerByName = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name } = req.params; // Get name from URL params instead of query

    if (!name?.trim()) {
      throw new ApiError(400, "Customer name is required in URL parameters");
    }

    const customer = await prisma.customer.findFirst({
      where: {
        name: {
          contains: name.trim(),
          mode: "insensitive",
        },
      },
      orderBy: { createdAt: "desc" },
    });

    successResponse(
      res,
      200,
      {
        exists: !!customer,
        customer: customer || null,
      },
      customer ? "Customer found" : "No customer found"
    );
  } catch (error) {
    next(error);
  }
};

// Standard Order Functions
export const createOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      customerName,
      customerPhone,
      customerAddress,
      salesPerson,
      deliveryMethod,
      transportName,
      transportPhone,
      items,
      remarks,
    } = req.body;

    // Validate required fields
    if (!customerName?.trim()) {
      throw new ApiError(400, "Customer name is required");
    }
    if (!Array.isArray(items) || items.length === 0) {
      throw new ApiError(400, "At least one order item is required");
    }

    // Clean phone numbers
    const cleanCustomerPhone = customerPhone?.replace(/\D/g, "") || null;
    const cleanTransportPhone = transportPhone?.replace(/\D/g, "") || null;

    // Check if customer exists
    let customer = await prisma.customer.findFirst({
      where: {
        OR: [
          { name: customerName.trim() },
          ...(cleanCustomerPhone
            ? [{ customerPhone: cleanCustomerPhone }]
            : []),
        ],
      },
    });

    // Create or update customer
    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          name: customerName.trim(),
          customerPhone: cleanCustomerPhone,
          customerAddress: customerAddress?.trim(),
        },
      });
    } else if (
      customerAddress &&
      customer.customerAddress !== customerAddress.trim()
    ) {
      customer = await prisma.customer.update({
        where: { id: customer.id },
        data: { customerAddress: customerAddress.trim() },
      });
    }

    // Generate order ID
    const today = new Date();
    const datePrefix = today.toISOString().slice(0, 10).replace(/-/g, "");
    const lastOrder = await prisma.order.findFirst({
      where: { orderId: { startsWith: `ORD-${datePrefix}` } },
      orderBy: { orderId: "desc" },
      select: { orderId: true },
    });

    const lastSeq = lastOrder?.orderId.split("-")[2];
    const nextSeq = lastSeq ? parseInt(lastSeq) + 1 : 1;
    const orderId = `ORD-${datePrefix}-${nextSeq.toString().padStart(3, "0")}`;

    // Validate and prepare order items
    const orderItems = items.map((item: any) => {
      if (!item.itemName?.trim()) {
        throw new ApiError(400, "Item name is required for all order items");
      }
      if (!item.quantity || isNaN(item.quantity) || item.quantity <= 0) {
        throw new ApiError(400, "Valid quantity is required for all items");
      }

      const unitPrice = parseFloat(item.unitPrice) || 0;
      const quantity = parseInt(item.quantity);
      const total = unitPrice * quantity;

      return {
        itemName: item.itemName.trim(),
        colorTop: item.colorTop?.trim(),
        colorBottom: item.colorBottom?.trim(),
        length: parseFloat(item.length) || 0,
        width: parseFloat(item.width) || 0,
        gsm: parseInt(item.gsm) || 0,
        weight: parseFloat(item.weight) || null,
        quantity,
        unit: item.unit?.trim() || "units",
        unitPrice,
        total,
        variant: item.variant?.trim(),
      };
    });

    const total = orderItems.reduce((sum, item) => sum + item.total, 0);

    // Create order
    const order = await prisma.order.create({
      data: {
        orderId,
        customerId: customer.id,
        salesPerson: salesPerson?.trim(),
        deliveryMethod,
        transportName: transportName?.trim(),
        transportPhone: cleanTransportPhone,
        total,
        remarks: remarks?.trim(),
        items: {
          create: orderItems,
        },
      },
      include: {
        items: true,
        customer: {
          select: {
            id: true,
            name: true,
            customerPhone: true,
            customerAddress: true,
          },
        },
      },
    });

    successResponse(
      res,
      201,
      {
        orderId: order.orderId,
        customer,
        items: order.items,
        total: order.total,
        status: "PENDING",
      },
      "Order created successfully"
    );
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
    const { status, search, page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: Prisma.OrderWhereInput = {};
    if (status) where.status = status as OrderStatus;
    if (search) {
      where.OR = [
        { orderId: { contains: search as string, mode: "insensitive" } },
        {
          customer: {
            is: { name: { contains: search as string, mode: "insensitive" } },
          },
        },
        {
          customer: {
            is: {
              customerPhone: {
                contains: search as string,
                mode: "insensitive",
              },
            },
          },
        },
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { items: true, dispatch: true, customer: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: Number(limit),
      }),
      prisma.order.count({ where }),
    ]);

    successResponse(
      res,
      200,
      {
        orders: orders.map((order) => ({
          id: order.id,
          orderId: order.orderId,
          customer: order.customer?.name,
          date: order.createdAt.toISOString().split("T")[0],
          status: order.status,
          product:
            order.items.length > 0 ? order.items[0].itemName : "No items",
          total: order.total,
          trackingId: order.dispatch?.trackingId,
        })),
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit)),
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
    const { filter, page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    if (filter === "pending") where.status = "PENDING";
    if (filter === "in_production") where.status = "IN_PRODUCTION";
    if (filter === "completed") where.status = "COMPLETED";
    if (filter === "shipped") where.status = "SHIPPED";
    if (filter === "delivered") where.status = "DELIVERED";

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: true,
          dispatch: true,
          customer: true,
        },
        orderBy: { date: "desc" },
        skip,
        take: Number(limit),
      }),
      prisma.order.count({ where }),
    ]);

    const counts = await Promise.all([
      prisma.order.count({ where: { status: "PENDING" } }),
      prisma.order.count({ where: { status: "IN_PRODUCTION" } }),
      prisma.order.count({ where: { status: "COMPLETED" } }),
      prisma.order.count({ where: { status: "SHIPPED" } }),
      prisma.order.count({ where: { status: "DELIVERED" } }),
    ]);

    const formattedOrders = orders.map((order) => ({
      id: order.id,
      orderId: order.orderId,
      customer: order.customer?.name,
      date: order.date.toISOString().split("T")[0],
      status: order.status,
      product: order.items.length > 0 ? "Custom product" : "No items",
      total: order.total,
      trackingId: order.dispatch?.trackingId,
    }));

    successResponse(
      res,
      200,
      {
        summary: {
          pending: counts[0],
          in_production: counts[1],
          completed: counts[2],
          shipped: counts[3],
          delivered: counts[4],
        },
        orders: formattedOrders,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
      "Order book retrieved successfully"
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
      where: { id },
      include: {
        items: true,
        dispatch: true,
        ProductionBatch: true,
        customer: true,
      },
    });

    if (!order) throw new ApiError(404, "Order not found");

    const response = {
      orderId: order.orderId,
      customer: {
        name: order.customer?.name,
        phone: order.customer?.customerPhone,
        address: order.customer?.customerAddress,
      },
      orderInfo: {
        date: order.date.toISOString(),
        status: order.status,
        salesPerson: order.salesPerson,
        deliveryMethod: order.deliveryMethod,
        transportName: order.transportName,
        transportPhone: order.transportPhone,
        remarks: order.remarks,
      },
      products: order.items.map((item: any) => ({
        id: item.id,
        colorTop: item.colorTop,
        colorBottom: item.colorBottom,
        length: item.length,
        width: item.width,
        weight: item.weight,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        total: item.total,
        variant: item.variant,
      })),
      dispatch: order.dispatch,
      productions: order.ProductionBatch,
      totals: {
        subtotal: order.total,
        total: order.total,
      },
    };

    successResponse(res, 200, response, "Order details retrieved");
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

    const validStatuses = [
      "PENDING",
      "PROCESSING",
      "IN_PRODUCTION",
      "COMPLETED",
      "SHIPPED",
      "DELIVERED",
      "CANCELLED",
      "DELAYED",
    ];
    if (!validStatuses.includes(status))
      throw new ApiError(400, "Invalid status value");

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { status },
    });

    successResponse(
      res,
      200,
      {
        orderId: updatedOrder.orderId,
        status: updatedOrder.status,
      },
      "Order status updated"
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
    const { items } = req.body;

    if (!items?.length) throw new ApiError(400, "Items array required");

    // Calculate new items with totals
    const newItems = items.map((item: any) => {
      const unitPrice = item.unitPrice || 0;
      const total = unitPrice * (item.quantity || 1);

      return {
        itemName: item.itemName,
        colorTop: item.colorTop,
        colorBottom: item.colorBottom,
        length: item.length,
        width: item.width,
        gsm: item.gsm,
        weight: item.weight,
        quantity: item.quantity || 1,
        unit: item.unit || "units",
        unitPrice: unitPrice,
        total: total,
        variant: item.variant,
      };
    });

    // Get current order with items to calculate new total
    const currentOrder = await prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!currentOrder) throw new ApiError(404, "Order not found");

    // Calculate new total (current total + new items total)
    const newItemsTotal = newItems.reduce(
      (sum: number, item: any) => sum + item.total,
      0
    );
    const newTotal = (currentOrder.total || 0) + newItemsTotal;

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        total: newTotal,
        items: { create: newItems },
      },
      include: { items: true },
    });

    successResponse(
      res,
      200,
      {
        orderId: updatedOrder.id,
        items: updatedOrder.items,
        total: updatedOrder.total,
      },
      "Order products updated"
    );
  } catch (error) {
    next(error);
  }
};

export const getPendingOrders = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { status: "PENDING" },
        include: { items: true, customer: true },
        orderBy: { date: "desc" },
        skip,
        take: Number(limit),
      }),
      prisma.order.count({ where: { status: "PENDING" } }),
    ]);

    const formattedOrders = orders.map((order) => ({
      orderId: order.orderId,
      customer: order.customer?.name,
      date: order.date.toISOString().split("T")[0],
      products: order.items.length > 0 ? "Custom product" : "No items",
      total: order.total,
    }));

    successResponse(
      res,
      200,
      {
        orders: formattedOrders,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
      "Pending orders retrieved"
    );
  } catch (error) {
    next(error);
  }
};

export const getDispatchedOrders = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { status: { in: ["SHIPPED", "DELIVERED"] } },
        include: {
          items: true,
          dispatch: true,
          customer: true,
        },
        orderBy: { date: "desc" },
        skip,
        take: Number(limit),
      }),
      prisma.order.count({
        where: { status: { in: ["SHIPPED", "DELIVERED"] } },
      }),
    ]);

    const formattedOrders = orders.map((order) => ({
      orderId: order.orderId,
      customer: order.customer?.name,
      date: order.date.toISOString().split("T")[0],
      products: order.items.length > 0 ? "Custom product" : "No items",
      total: order.total,
      status: order.status,
      trackingId: order.dispatch?.trackingId,
    }));

    successResponse(
      res,
      200,
      {
        orders: formattedOrders,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
      "Dispatched orders retrieved"
    );
  } catch (error) {
    next(error);
  }
};

export const getCancelledOrders = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { status: "CANCELLED" },
        include: { items: true, customer: true },
        orderBy: { date: "desc" },
        skip,
        take: Number(limit),
      }),
      prisma.order.count({ where: { status: "CANCELLED" } }),
    ]);

    const formattedOrders = orders.map((order) => ({
      orderId: order.orderId,
      customer: order.customer?.name,
      date: order.date.toISOString().split("T")[0],
      products: order.items.length > 0 ? "Custom product" : "No items",
      total: order.total,
    }));

    successResponse(
      res,
      200,
      {
        orders: formattedOrders,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
      "Cancelled orders retrieved"
    );
  } catch (error) {
    next(error);
  }
};

export const filterOrders = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      status,
      customer,
      product,
      startDate,
      endDate,
      page = 1,
      limit = 10,
    } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    if (status) where.status = status;
    if (customer)
      where.customer = {
        is: {
          name: {
            contains: customer as string,
            mode: "insensitive" as Prisma.QueryMode,
          },
        },
      };
    if (product) {
      where.items = {
        some: {
          OR: [
            { colorTop: { contains: product as string, mode: "insensitive" } },
            {
              colorBottom: { contains: product as string, mode: "insensitive" },
            },
            { variant: { contains: product as string, mode: "insensitive" } },
          ],
        },
      };
    }
    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      };
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: true,
          dispatch: true,
          customer: true,
        },
        orderBy: { date: "desc" },
        skip,
        take: Number(limit),
      }),
      prisma.order.count({ where }),
    ]);

    const formattedOrders = orders.map((order) => ({
      orderId: order.orderId,
      customer: order.customer?.name,
      date: order.date.toISOString().split("T")[0],
      status: order.status,
      products: order.items.length > 0 ? "Custom product" : "No items",
      total: order.total,
      trackingId: order.dispatch?.trackingId,
    }));

    successResponse(
      res,
      200,
      {
        orders: formattedOrders,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
      "Filtered orders retrieved"
    );
  } catch (error) {
    next(error);
  }
};

export const filterOrderBook = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      status,
      search,
      startDate,
      endDate,
      page = 1,
      limit = 10,
    } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        {
          orderId: {
            contains: search as string,
            mode: "insensitive" as Prisma.QueryMode,
          },
        },
        {
          customer: {
            is: {
              name: {
                contains: search as string,
                mode: "insensitive" as Prisma.QueryMode,
              },
            },
          },
        },
      ];
    }
    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      };
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: true,
          dispatch: true,
          customer: true,
        },
        orderBy: { date: "desc" },
        skip,
        take: Number(limit),
      }),
      prisma.order.count({ where }),
    ]);

    const formattedOrders = orders.map((order) => ({
      orderId: order.orderId,
      customer: order.customer?.name,
      date: order.date.toISOString().split("T")[0],
      status: order.status,
      product: order.items.length > 0 ? "Custom product" : "No items",
      total: order.total,
      trackingId: order.dispatch?.trackingId,
    }));

    successResponse(
      res,
      200,
      {
        orders: formattedOrders,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
      "Filtered order book retrieved"
    );
  } catch (error) {
    next(error);
  }
};

export const searchOrders = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { query, page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    if (!query) throw new ApiError(400, "Search query required");

    const where: Prisma.OrderWhereInput = {
      OR: [
        {
          orderId: {
            contains: query as string,
            mode: "insensitive" as Prisma.QueryMode,
          },
        },
        {
          customer: {
            is: {
              name: {
                contains: query as string,
                mode: "insensitive" as Prisma.QueryMode,
              },
            },
          },
        },
        {
          customer: {
            is: {
              customerPhone: {
                contains: query as string,
                mode: "insensitive" as Prisma.QueryMode,
              },
            },
          },
        },
      ],
    };

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: true,
          dispatch: true,
          customer: true,
        },
        orderBy: { date: "desc" },
        skip,
        take: Number(limit),
      }),
      prisma.order.count({ where }),
    ]);

    const formattedOrders = orders.map((order) => ({
      orderId: order.orderId,
      customer: order.customer?.name,
      date: order.date.toISOString().split("T")[0],
      status: order.status,
      product: order.items.length > 0 ? "Custom product" : "No items",
      total: order.total,
      trackingId: order.dispatch?.trackingId,
    }));

    successResponse(
      res,
      200,
      {
        orders: formattedOrders,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
      "Search results retrieved"
    );
  } catch (error) {
    next(error);
  }
};
