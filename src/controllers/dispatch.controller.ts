import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "../../generated/prisma";
import { ApiError } from "../utils/apiError";
import { successResponse } from "../utils/apiResponse";

const prisma = new PrismaClient();

export const createDispatch = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      orderId,
      loadingDate,
      driverName,
      shippingAddress,
      customer,
      carNumber,
      driverNumber,
      carrier,
      transportation,
      packageDetails,
      remarks,
    } = req.body;

    // Validate required fields
    if (!orderId || !customer || !shippingAddress) {
      throw new ApiError(
        400,
        "Order ID, customer, and shipping address are required"
      );
    }

    // Check if order exists and is ready for dispatch
    const order = await prisma.order.findUnique({
      where: { orderId },
      include: { dispatch: true },
    });

    if (!order) {
      throw new ApiError(404, "Order not found");
    }
    if (order.dispatch) {
      throw new ApiError(400, "Order already has a dispatch record");
    }

    // Generate dispatch ID
    const lastDispatch = await prisma.dispatch.findFirst({
      orderBy: { dispatchId: "desc" },
    });
    const nextId = lastDispatch
      ? parseInt(lastDispatch.dispatchId.replace("DIS", "")) + 1
      : 1;
    const dispatchId = `DIS${nextId.toString().padStart(3, "0")}`;

    // Create dispatch
    const dispatch = await prisma.dispatch.create({
      data: {
        dispatchId,
        orderId: order.id,
        customer,
        loadingDate: loadingDate ? new Date(loadingDate) : null,
        driverName,
        shippingAddress,
        carNumber,
        driverNumber,
        carrier,
        transportation,
        packageDetails,
        remarks,
        status: "READY_FOR_PICKUP",
      } as any,
      include: {
        order: true,
      },
    });

    // Update order status
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "SHIPPED" },
    });

    successResponse(res, 201, dispatch, "Dispatch created successfully");
  } catch (error) {
    next(error);
  }
};

export const getTodayDispatches = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [count, dispatches] = await Promise.all([
      prisma.dispatch.count({
        where: {
          createdAt: { gte: todayStart },
        },
      }),
      prisma.dispatch.findMany({
        where: {
          createdAt: { gte: todayStart },
        },
        orderBy: { createdAt: "desc" },
        take: 4, // Show 4 in the "Today's Dispatch Status" section
      }),
    ]);

    successResponse(
      res,
      200,
      {
        todaysDispatches: count,
        recentDispatches: dispatches,
      },
      "Today's dispatches retrieved successfully"
    );
  } catch (error) {
    next(error);
  }
};

export const getAllDispatches = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { status, search, page = 1, limit = 10 } = req.query;

    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { dispatchId: { contains: search as string } },
        { order: { orderId: { contains: search as string } } },
        { customer: { contains: search as string } },
      ];
    }

    const [dispatches, total] = await Promise.all([
      prisma.dispatch.findMany({
        where,
        include: {
          order: {
            select: { orderId: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.dispatch.count({ where }),
    ]);

    successResponse(
      res,
      200,
      {
        dispatches,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
      "Dispatches retrieved successfully"
    );
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
    const { status, trackingId, remarks } = req.body;

    if (
      !status ||
      !["READY_FOR_PICKUP", "IN_TRANSIT", "DELIVERED", "DELAYED"].includes(
        status
      )
    ) {
      throw new ApiError(400, "Valid status is required");
    }

    const dispatch = await prisma.dispatch.update({
      where: { id },
      data: {
        status,
        ...(trackingId && { trackingId }),
        ...(remarks && { remarks }),
      },
    });

    successResponse(res, 200, dispatch, "Dispatch status updated successfully");
  } catch (error) {
    next(error);
  }
};
