import { Request, Response, NextFunction } from "express";
import { prisma } from "../utils/prisma";
import { ApiError } from "../utils/apiError";
import { successResponse } from "../utils/apiResponse";

export const getSalesReport = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { startDate, endDate } = req.query;

    const where: any = {};
    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      };
    }

    // Total revenue
    const orders = await prisma.order.findMany({
      where: {
        ...where,
        status: "DELIVERED",
      },
    });

    const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);

    // Orders completed
    const ordersCompleted = orders.length;

    // Active customers
    const activeCustomers = await prisma.customer.count({
      where: {
        orders: {
          some: {
            ...where,
            status: "DELIVERED",
          },
        },
      },
    });

    // Top selling products
    const topSellingProducts = await prisma.product.findMany({
      orderBy: {
        unitsSold: "desc",
      },
      take: 5,
    });

    successResponse(
      res,
      200,
      {
        totalRevenue,
        ordersCompleted,
        activeCustomers,
        topSellingProducts,
      },
      "Sales report generated successfully"
    );
  } catch (error) {
    next(error);
  }
};

export const getInventoryReport = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const rawMaterials = await prisma.rawMaterial.findMany();
    const products = await prisma.product.findMany();

    const lowStockItems = [...rawMaterials, ...products].filter(
      (item) => item.status === "LOW_STOCK" || item.status === "OUT_OF_STOCK"
    );

    successResponse(
      res,
      200,
      {
        rawMaterials,
        products,
        lowStockItems,
      },
      "Inventory report generated successfully"
    );
  } catch (error) {
    next(error);
  }
};
