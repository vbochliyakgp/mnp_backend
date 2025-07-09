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

    console.log("Dispatch data:", req.body);

    // Validate required fields
    if (!orderId || !customer || !shippingAddress) {
      throw new ApiError(
        400,
        "Order ID, customer, and shipping address are required"
      );
    }

    // Validate packageDetails array
    if (!Array.isArray(packageDetails) || packageDetails.length === 0) {
      throw new ApiError(400, "Package details are required");
    }

    // Check if order exists and is ready for dispatch
    const order = await prisma.order.findUnique({
      where: { orderId },
      include: { dispatch: true },
    });

    if (!order) {
      throw new ApiError(404, "Order not found");
    }

    // Generate dispatch ID
    const lastDispatch = await prisma.dispatch.findFirst({
      orderBy: { dispatchId: "desc" },
    });
    const nextId = lastDispatch
      ? parseInt(lastDispatch.dispatchId.replace("DIS", "")) + 1
      : 1;
    const dispatchId = `DIS${nextId.toString().padStart(3, "0")}`;

    // Generate package details string
    const packageDetailsString = packageDetails
      .map((item: any) => {
        if (item.type === "ROLL") {
          return `${item.itemName || ''} ${item.rollType || ''}_${item.gsm || ''}_${item.colorTop || ''}/${item.colorBottom || ''}_${item.width  || ''}(In) (Qty: ${item.deliveredQuantity || 0})`;
        }
        return `${item.itemName || ''}_${item.gsm || ''}_${item.colorTop || ''}_${item.colorBottom || ''}_${item.length || ''}(ft)X${item.width || ''}(ft) (Qty: ${item.deliveredQuantity || 0})`;
      })
      .join(", ");

    // Calculate total amount from packageDetails
    const totalAmount = packageDetails.reduce((sum: number, item: any) => {
      const itemAmount =
        (Number(item.rate) || 0) *
        (Number(item.metricValue) || 0) *
        (Number(item.deliveredQuantity) || 0);
      return sum + itemAmount;
    }, 0);

    // TRANSACTION: Only critical operations that must be atomic
    const dispatch = await prisma.$transaction(
      async (prisma) => {
        // Create dispatch record
        const newDispatch = await prisma.dispatch.create({
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
            packageDetails: packageDetailsString,
            remarks,
            status: "READY_FOR_PICKUP",
            totalAmount,
            itemDetails: packageDetails.map((item: any) => ({
              deliveredQuantity: item.deliveredQuantity,
              itemName: item.type === "ROLL" ? `${item.itemName || ''} ${item.rollType || ''}_${item.gsm || ''}_${item.colorTop || ''}/${item.colorBottom || ''}_${item.width  || ''}(In) (Qty: ${item.deliveredQuantity || 0})` : `${item.itemName || ''}_${item.gsm || ''}_${item.colorTop || ''}_${item.colorBottom || ''}_${item.length || ''}(ft)X${item.width || ''}(ft) (Qty: ${item.deliveredQuantity || 0})`,
              rate: item.rate,
              metricValue: item.metricValue,
              itemId: item.itemId,
              unit: item.unit,
              total:
                (Number(item.rate) || 0) *
                (Number(item.metricValue) || 0) *
                (Number(item.deliveredQuantity) || 0),
            })),
          } as any,
          include: {
            order: true,
          },
        });
        
        let flag = true;
        // Update order item quantities
        await Promise.all(
          packageDetails.map(async (item: any) => {
            if (item.id && item.deliveredQuantity) {
              try {
                const currentOrderItem = await prisma.orderItem.findFirst({
                  where: { 
                    id: item.id,
                    orderId: order.id // Ensure it belongs to this order
                  },
                  select: { quantity: true, id: true, itemName: true },
                });

                if (currentOrderItem) {
                  const newQuantity = Math.max(
                    0,
                    currentOrderItem.quantity - Number(item.deliveredQuantity)
                  );

                  console.log(`Updating ${currentOrderItem.itemName}: ${currentOrderItem.quantity} - ${item.deliveredQuantity} = ${newQuantity}`);
                  if(newQuantity !== 0) {
                    flag = false;
                  }
                  await prisma.orderItem.update({
                    where: { id: item.id },
                    data: { quantity: newQuantity },
                  });
                }
              } catch (error) {
                console.error(`Error updating order item ${item.id}:`, error);
              }
            }
          })
        );

        // Update order status with calculated total
        if(flag) {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            status: "SHIPPED",
            total: order.total + totalAmount,
          },
        });
      }

        return newDispatch;
      },
      {
        timeout: 10000, // Increased timeout to 10 seconds as fallback
      }
    );

    // OUTSIDE TRANSACTION: Update product stock (independent operations)
    try {
      await Promise.all(
        packageDetails.map(async (item: any) => {
          const {
            itemName,
            type,
            rollType,
            rollNumber,
            gsm,
            colorTop,
            colorBottom,
            length,
            width,
            deliveredQuantity,
          } = item;

          // Parse values once
          const parsedRollNumber = rollNumber ? parseInt(rollNumber) : undefined;
          const parsedGsm = gsm ? parseInt(gsm) : undefined;
          const parsedLength = length ? parseFloat(length) : undefined;
          const parsedWidth = width ? parseFloat(width) : undefined;
          const parsedQuantity = Number(deliveredQuantity) || 0;

          // Skip if no quantity to update
          if (parsedQuantity <= 0) return;

          let existingProduct;

          if (type === "ROLL") {
            existingProduct = await prisma.product.findFirst({
              where: {
                name: itemName,
                rollType,
                gsm: parsedGsm,
                colorTop,
                colorBottom,
                width: parsedWidth,
              },
            });
          } else if (type === "BUNDLE") {
            existingProduct = await prisma.product.findFirst({
              where: {
                name: itemName,
                gsm: parsedGsm,
                colorTop,
                colorBottom,
                length: parsedLength,
                width: parsedWidth,
              },
            });
          }

          if (existingProduct) {
            const newStock = Math.max(0, existingProduct.stock - parsedQuantity);
            console.log(`Updating product ${itemName} stock: ${existingProduct.stock} - ${parsedQuantity} = ${newStock}`);
            
            await prisma.product.update({
              where: { id: existingProduct.id },
              data: {
                stock: newStock,
                status: newStock > 0 ? "IN_STOCK" : "OUT_OF_STOCK",
              },
            });
          }
        })
      );
    } catch (error) {
      console.error("Error updating product stock:", error);
      // Product stock update failure doesn't affect dispatch creation
    }

    console.log("Dispatch created:", dispatch);
    successResponse(res, 201, dispatch, "Dispatch created successfully");
  } catch (error) {
    console.error("Error creating dispatch:", error);
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
        { carrier: { contains: search as string } }, // Added carrier search
      ];
    }

    const [dispatches, total] = await Promise.all([
      prisma.dispatch.findMany({
        where,
        include: {
          order: {
            include: { items: true },
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
    const { status, remarks } = req.body;

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
        ...(remarks && { remarks }),
      },
    });

    successResponse(res, 200, dispatch, "Dispatch status updated successfully");
  } catch (error) {
    next(error);
  }
};

export const searchShipments = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      query,
      status,
      startDate,
      endDate,
      carrier,
      page = 1,
      limit = 10,
    } = req.query;

    const where: any = {};

    // Search across multiple fields
    if (query) {
      where.OR = [
        { dispatchId: { contains: query as string, mode: "insensitive" } },
        {
          order: {
            orderId: { contains: query as string, mode: "insensitive" },
          },
        },
        { customer: { contains: query as string, mode: "insensitive" } },
        { driverName: { contains: query as string, mode: "insensitive" } },
        { carNumber: { contains: query as string, mode: "insensitive" } },
        { shippingAddress: { contains: query as string, mode: "insensitive" } },
      ];
    }

    // Status filter
    if (status && status !== "All") {
      where.status = status;
    }

    // Date range filter
    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      };
    }

    // Carrier filter
    if (carrier && carrier !== "All") {
      where.carrier = carrier;
    }

    const [shipments, totalCount] = await Promise.all([
      prisma.dispatch.findMany({
        where,
        include: {
          order: {
            select: {
              orderId: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.dispatch.count({ where }),
    ]);

    // Format response to match UI
    const formattedShipments = shipments.map((shipment) => ({
      dispatchId: shipment.dispatchId,
      orderId: shipment.order?.orderId || "N/A",
      customer: shipment.customer,
      status: shipment.status
        .split("_")
        .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
        .join(" "), // Convert READY_FOR_PICKUP to "Ready for pickup"
      date: shipment.createdAt.toISOString().split("T")[0],
      carrier: shipment.carrier,
    }));

    successResponse(
      res,
      200,
      {
        shipments: formattedShipments,
        pagination: {
          total: totalCount,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(totalCount / Number(limit)),
        },
      },
      "Shipments retrieved successfully"
    );
  } catch (error) {
    next(error);
  }
};

export const getDeliveredShipments = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { search, page = 1, limit = 10 } = req.query;

    const where: any = {
      status: "DELIVERED",
    };

    if (search) {
      where.OR = [
        { dispatchId: { contains: search as string, mode: "insensitive" } },
        {
          order: {
            orderId: { contains: search as string, mode: "insensitive" },
          },
        },
        { customer: { contains: search as string, mode: "insensitive" } },
      ];
    }

    const [shipments, totalCount] = await Promise.all([
      prisma.dispatch.findMany({
        where,
        include: {
          order: {
            select: {
              orderId: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.dispatch.count({ where }),
    ]);

    const formattedShipments = shipments.map((shipment) => ({
      dispatchId: shipment.dispatchId,
      orderId: shipment.order?.orderId || "N/A",
      customer: shipment.customer,
      status: "Delivered", // Hardcoded since we're filtering by status
      date: shipment.createdAt.toISOString().split("T")[0],
      carrier: shipment.carrier,
    }));

    successResponse(
      res,
      200,
      {
        shipments: formattedShipments,
        pagination: {
          total: totalCount,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(totalCount / Number(limit)),
        },
      },
      "Delivered shipments retrieved successfully"
    );
  } catch (error) {
    next(error);
  }
};

export const getInTransitShipments = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { search, page = 1, limit = 10 } = req.query;

    const where: any = {
      status: "IN_TRANSIT",
    };

    if (search) {
      where.OR = [
        { dispatchId: { contains: search as string, mode: "insensitive" } },
        {
          order: {
            orderId: { contains: search as string, mode: "insensitive" },
          },
        },
        { customer: { contains: search as string, mode: "insensitive" } },
      ];
    }

    const [shipments, totalCount] = await Promise.all([
      prisma.dispatch.findMany({
        where,
        include: {
          order: {
            select: {
              orderId: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.dispatch.count({ where }),
    ]);

    const formattedShipments = shipments.map((shipment) => ({
      dispatchId: shipment.dispatchId,
      orderId: shipment.order?.orderId || "N/A",
      customer: shipment.customer,
      status: "In Transit", // Hardcoded since we're filtering by status
      date: shipment.createdAt.toISOString().split("T")[0],
      carrier: shipment.carrier,
    }));

    successResponse(
      res,
      200,
      {
        shipments: formattedShipments,
        pagination: {
          total: totalCount,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(totalCount / Number(limit)),
        },
      },
      "In Transit shipments retrieved successfully"
    );
  } catch (error) {
    next(error);
  }
};
