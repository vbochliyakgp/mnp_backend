import { Request, Response, NextFunction } from "express";
import { PrismaClient, Prisma } from "../../generated/prisma";
import { ApiError } from "../utils/apiError";
import { successResponse } from "../utils/apiResponse";

const prisma = new PrismaClient();

// Type definitions
type OrderStatus = 'PENDING' | 'PROCESSING' | 'IN_PRODUCTION' | 'COMPLETED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'DELAYED';
type ProductionStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'DELAYED';
type DispatchStatus = 'READY_FOR_PICKUP' | 'IN_TRANSIT' | 'DELIVERED' | 'DELAYED';

// WhatsApp Integration Functions
export const getCustomerByWhatsApp = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { whatsapp } = req.params;
    const cleanWhatsapp = whatsapp.replace(/\D/g, "");

    const order = await prisma.order.findFirst({
      where: {
        customerPhone: {
          contains: cleanWhatsapp,
        },
      },
      orderBy: { createdAt: "desc" },
      select: {
        customer: true,
        customerPhone: true,
        customerAddress: true,
      },
    });

    successResponse(
      res,
      200,
      {
        exists: !!order,
        customer: order
          ? {
              name: order.customer,
              phone: order.customerPhone,
              address: order.customerAddress,
            }
          : null,
      },
      order ? "Customer found" : "No customer found"
    );
  } catch (error) {
    next(error);
  }
};

export const createOrderByWhatsApp = async (
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

    if (!customerName || !customerPhone || !items?.length) {
      throw new ApiError(
        400,
        "Customer name, WhatsApp number and items are required"
      );
    }

    const today = new Date();
    const datePrefix = today.toISOString().slice(0, 10).replace(/-/g, "");
    const lastOrder = await prisma.order.findFirst({
      where: { orderId: { startsWith: `WA-${datePrefix}` } },
      orderBy: { orderId: "desc" },
    });

    const nextSeq = lastOrder
      ? parseInt(lastOrder.orderId.split("-")[2]) + 1
      : 1;
    const orderId = `WA-${datePrefix}-${nextSeq.toString().padStart(3, "0")}`;

    const products = await prisma.product.findMany({
      where: { id: { in: items.map((i: any) => i.productId) } },
    });

    const orderItems = items.map((item: any) => {
      const product = products.find((p) => p.id === item.productId);
      if (!product) throw new ApiError(404, `Product not found: ${item.productId}`);

      return {
        productId: item.productId,
        colorTop: item.colorTop,
        colorBottom: item.colorBottom,
        length: item.length || product.length,
        width: item.width || product.width,
        weight: item.weight || product.weight,
        quantity: item.quantity,
        unit: item.unit || product.unit,
        unitPrice: product.price,
        total: product.price * item.quantity,
        variant: item.variant,
      };
    });

    const total = orderItems.reduce((sum: number, item: any) => sum + item.total, 0);

    const order = await prisma.order.create({
      data: {
        orderId,
        customer: customerName,
        customerPhone: customerPhone.replace(/\D/g, ""),
        customerAddress,
        salesPerson,
        deliveryMethod,
        transportName,
        transportPhone: transportPhone?.replace(/\D/g, ""),
        total,
        remarks,
        items: { create: orderItems },
      },
      include: { items: { include: { product: true } } },
    });

    successResponse(
      res,
      201,
      {
        orderId: order.orderId,
        customer: {
          name: order.customer,
          phone: order.customerPhone,
          address: order.customerAddress,
        },
        items: order.items,
        total: order.total,
        status: "PENDING",
      },
      "WhatsApp order created successfully"
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

    if (!customerName || !items?.length) {
      throw new ApiError(400, "Customer name and items are required");
    }

    const today = new Date();
    const datePrefix = today.toISOString().slice(0, 10).replace(/-/g, "");
    const lastOrder = await prisma.order.findFirst({
      where: { orderId: { startsWith: `ORD-${datePrefix}` } },
      orderBy: { orderId: "desc" },
    });

    const nextSeq = lastOrder
      ? parseInt(lastOrder.orderId.split("-")[2]) + 1
      : 1;
    const orderId = `ORD-${datePrefix}-${nextSeq.toString().padStart(3, "0")}`;

    const products = await prisma.product.findMany({
      where: { id: { in: items.map((i: any) => i.productId) } },
    });

    const orderItems = items.map((item: any) => {
      const product = products.find((p) => p.id === item.productId);
      if (!product) throw new ApiError(404, `Product not found: ${item.productId}`);

      return {
        productId: item.productId,
        colorTop: item.colorTop,
        colorBottom: item.colorBottom,
        length: item.length || product.length,
        width: item.width || product.width,
        weight: item.weight || product.weight,
        quantity: item.quantity,
        unit: item.unit || product.unit,
        unitPrice: product.price,
        total: product.price * item.quantity,
        variant: item.variant,
      };
    });

    const total = orderItems.reduce((sum: number, item: any) => sum + item.total, 0);

    const order = await prisma.order.create({
      data: {
        orderId,
        customer: customerName,
        customerPhone: customerPhone?.replace(/\D/g, ""),
        customerAddress,
        salesPerson,
        deliveryMethod,
        transportName,
        transportPhone: transportPhone?.replace(/\D/g, ""),
        total,
        remarks,
        items: { create: orderItems },
      },
      include: { items: { include: { product: true } } },
    });

    successResponse(
      res,
      201,
      {
        orderId: order.orderId,
        customer: {
          name: order.customer,
          phone: order.customerPhone,
          address: order.customerAddress,
        },
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

    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { orderId: { contains: search as string, mode: "insensitive" as Prisma.QueryMode } },
        { customer: { contains: search as string, mode: "insensitive" as Prisma.QueryMode } },
        { customerPhone: { contains: search as string, mode: "insensitive" as Prisma.QueryMode } },
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { 
          items: { include: { product: true }, take: 1 },
          dispatch: true 
        },
        orderBy: { date: "desc" },
        skip,
        take: Number(limit),
      }),
      prisma.order.count({ where }),
    ]);

    const formattedOrders = orders.map((order) => ({
      id: order.id,
      orderId: order.orderId,
      customer: order.customer,
      phone: order.customerPhone,
      date: order.date.toISOString().split("T")[0],
      status: order.status,
      product: order.items[0]?.product?.name || "Multiple items",
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
    if (filter === 'pending') where.status = 'PENDING';
    if (filter === 'in_production') where.status = 'IN_PRODUCTION';
    if (filter === 'completed') where.status = 'COMPLETED';
    if (filter === 'shipped') where.status = 'SHIPPED';
    if (filter === 'delivered') where.status = 'DELIVERED';

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { 
          items: { include: { product: true }, take: 1 },
          dispatch: true 
        },
        orderBy: { date: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.order.count({ where }),
    ]);

    const counts = await Promise.all([
      prisma.order.count({ where: { status: 'PENDING' } }),
      prisma.order.count({ where: { status: 'IN_PRODUCTION' } }),
      prisma.order.count({ where: { status: 'COMPLETED' } }),
      prisma.order.count({ where: { status: 'SHIPPED' } }),
      prisma.order.count({ where: { status: 'DELIVERED' } }),
    ]);

    const formattedOrders = orders.map((order) => ({
      id: order.id,
      orderId: order.orderId,
      customer: order.customer,
      date: order.date.toISOString().split('T')[0],
      status: order.status,
      product: order.items[0]?.product?.name || 'Multiple items',
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
      'Order book retrieved successfully'
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
        items: {
          include: { product: true },
        },
        dispatch: true,
        ProductionBatch: true,
      },
    });

    if (!order) throw new ApiError(404, "Order not found");

    const response = {
      orderId: order.orderId,
      customer: {
        name: order.customer,
        phone: order.customerPhone,
        address: order.customerAddress,
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
        productId: item.product.id,
        name: item.product.name,
        type: item.product.type,
        gsm: item.product.gsm,
        length: item.length,
        width: item.width,
        colorTop: item.colorTop,
        colorBottom: item.colorBottom,
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

    const validStatuses: OrderStatus[] = [
      'PENDING',
      'PROCESSING',
      'IN_PRODUCTION',
      'COMPLETED',
      'SHIPPED',
      'DELIVERED',
      'CANCELLED',
      'DELAYED',
    ];

    if (!validStatuses.includes(status)) {
      throw new ApiError(400, 'Invalid status value');
    }

    if (['SHIPPED', 'DELIVERED'].includes(status)) {
      const order = await prisma.order.findUnique({
        where: { id },
        include: { dispatch: true },
      });

      if (!order) throw new ApiError(404, 'Order not found');
      if (!order.dispatch && status === 'SHIPPED') {
        throw new ApiError(400, 'Dispatch record must be created before shipping');
      }

      if (status === 'DELIVERED' && order.dispatch) {
        await prisma.dispatch.update({
          where: { id: order.dispatch.id },
          data: { status: 'DELIVERED' },
        });
      }
    }

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
        customer: updatedOrder.customer,
      },
      'Order status updated'
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

    const products = await prisma.product.findMany({
      where: { id: { in: items.map((i: any) => i.productId) } },
    });
    if (products.length !== items.length) {
      throw new ApiError(404, "One or more products not found");
    }

    const newItems = items.map((item: any) => {
      const product = products.find((p) => p.id === item.productId)!;
      return {
        productId: item.productId,
        colorTop: item.colorTop,
        colorBottom: item.colorBottom,
        length: item.length || product.length,
        width: item.width || product.width,
        weight: item.weight || product.weight,
        quantity: item.quantity,
        unit: item.unit || product.unit,
        unitPrice: product.price,
        total: product.price * item.quantity,
        variant: item.variant,
      };
    });

    const newTotal = newItems.reduce(
      (sum: number, item: any) => sum + item.total,
      0
    );

    const updatedOrder = await prisma.$transaction([
      prisma.orderItem.deleteMany({ where: { orderId: id } }),
      prisma.order.update({
        where: { id },
        data: {
          total: newTotal,
          items: { create: newItems },
        },
        include: { items: { include: { product: true } } },
      }),
    ]);

    successResponse(
      res,
      200,
      {
        orderId: updatedOrder[1].orderId,
        items: updatedOrder[1].items,
        total: updatedOrder[1].total,
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
        include: { items: { include: { product: true } } },
        orderBy: { date: "desc" },
        skip,
        take: Number(limit),
      }),
      prisma.order.count({ where: { status: "PENDING" } }),
    ]);

    const formattedOrders = orders.map((order) => ({
      orderId: order.orderId,
      customer: order.customer,
      date: order.date.toISOString().split("T")[0],
      products: order.items.map((i) => i.product.name).join(", "),
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
          items: { include: { product: true } },
          dispatch: true,
        },
        orderBy: { date: "desc" },
        skip,
        take: Number(limit),
      }),
      prisma.order.count({ where: { status: { in: ["SHIPPED", "DELIVERED"] } } }),
    ]);

    const formattedOrders = orders.map((order) => ({
      orderId: order.orderId,
      customer: order.customer,
      date: order.date.toISOString().split("T")[0],
      products: order.items.map((i) => i.product.name).join(", "),
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
        include: { items: { include: { product: true } } },
        orderBy: { date: "desc" },
        skip,
        take: Number(limit),
      }),
      prisma.order.count({ where: { status: "CANCELLED" } }),
    ]);

    const formattedOrders = orders.map((order) => ({
      orderId: order.orderId,
      customer: order.customer,
      date: order.date.toISOString().split("T")[0],
      products: order.items.map((i) => i.product.name).join(", "),
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
      where.customer = { contains: customer as string, mode: "insensitive" as Prisma.QueryMode };
    if (product) {
      where.items = {
        some: {
          product: {
            name: { contains: product as string, mode: "insensitive" as Prisma.QueryMode },
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

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { 
          items: { include: { product: true } },
          dispatch: true 
        },
        orderBy: { date: "desc" },
        skip,
        take: Number(limit),
      }),
      prisma.order.count({ where }),
    ]);

    const formattedOrders = orders.map((order) => ({
      orderId: order.orderId,
      customer: order.customer,
      date: order.date.toISOString().split("T")[0],
      status: order.status,
      products: order.items.map((i) => i.product.name).join(", "),
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
        { orderId: { contains: search as string, mode: "insensitive" as Prisma.QueryMode } },
        { customer: { contains: search as string, mode: "insensitive" as Prisma.QueryMode } },
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
          items: { include: { product: true }, take: 1 },
          dispatch: true 
        },
        orderBy: { date: "desc" },
        skip,
        take: Number(limit),
      }),
      prisma.order.count({ where }),
    ]);

    const formattedOrders = orders.map((order) => ({
      orderId: order.orderId,
      customer: order.customer,
      date: order.date.toISOString().split("T")[0],
      status: order.status,
      product: order.items[0]?.product?.name || "Multiple items",
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

    const where = {
      OR: [
        { orderId: { contains: query as string, mode: "insensitive" as Prisma.QueryMode } },
        { customer: { contains: query as string, mode: "insensitive" as Prisma.QueryMode } },
        { customerPhone: { contains: query as string, mode: "insensitive" as Prisma.QueryMode } },
      ],
    };

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { 
          items: { include: { product: true }, take: 1 },
          dispatch: true 
        },
        orderBy: { date: "desc" },
        skip,
        take: Number(limit),
      }),
      prisma.order.count({ where }),
    ]);

    const formattedOrders = orders.map((order) => ({
      orderId: order.orderId,
      customer: order.customer,
      date: order.date.toISOString().split("T")[0],
      status: order.status,
      product: order.items[0]?.product?.name || "Multiple items",
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