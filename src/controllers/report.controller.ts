import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "../../generated/prisma";
import { ApiError } from "../utils/apiError";
import { successResponse } from "../utils/apiResponse";
const prisma = new PrismaClient();

export const getDashboardSummary = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { period = "month" } = req.query;
    const dateRange = getDateRange(period as string);

    const [
      totalRevenue,
      completedOrders,
      activeCustomers,
      productionUnits,
      topProducts,
      inventoryStatus,
      productionEfficiency,
      customerSegments,
      repeatCustomerMetrics,
    ] = await Promise.all([
      // Total Revenue (only delivered orders)
      prisma.order.aggregate({
        _sum: { total: true },
        where: {
          status: "DELIVERED",
          updatedAt: dateRange,
        },
      }),

      // Completed Orders
      prisma.order.count({
        where: {
          status: "DELIVERED",
          updatedAt: dateRange,
        },
      }),

      // Active Customers (placed at least one order)
      prisma.customer.count({
        where: {
          orders: {
            some: {
              updatedAt: dateRange,
            },
          },
        },
      }),

      // Production Units Completed
      prisma.productionBatch.aggregate({
        _sum: { quantity: true },
        where: {
          status: "COMPLETED",
          endDate: dateRange,
        },
      }),

      // Top Selling Products
      prisma.product.findMany({
        orderBy: { unitsSold: "desc" },
        take: 4,
      }),

      // Inventory Status
      prisma.rawMaterial.findMany({
        where: {
          OR: [{ status: "LOW_STOCK" }, { status: "OUT_OF_STOCK" }],
        },
        orderBy: { stock: "asc" },
      }),

      // Production Efficiency
      calculateProductionEfficiency(dateRange),

      // Customer Segments by Order Value
      calculateCustomerSegments(dateRange),

      // Repeat Customer Metrics
      calculateRepeatCustomerMetrics(dateRange),
    ]);

    successResponse(
      res,
      200,
      {
        summary: {
          totalRevenue: totalRevenue._sum.total || 0,
          completedOrders,
          activeCustomers,
          productionUnits: productionUnits._sum.quantity || 0,
        },
        topProducts: topProducts.map((p) => ({
          name: p.name,
          unitsSold: p.unitsSold,
        })),
        inventoryStatus: {
          lowStock: inventoryStatus.filter((i) => i.status === "LOW_STOCK"),
          outOfStock: inventoryStatus.filter(
            (i) => i.status === "OUT_OF_STOCK"
          ),
        },
        productionEfficiency,
        customerSegments,
        repeatCustomerMetrics,
      },
      "Dashboard summary retrieved successfully"
    );
  } catch (error) {
    next(error);
  }
};

// Helper functions
function getDateRange(period: string) {
  const now = new Date();
  const gte = new Date(now);

  switch (period) {
    case "year":
      gte.setFullYear(gte.getFullYear() - 1);
      break;
    case "quarter":
      gte.setMonth(gte.getMonth() - 3);
      break;
    case "week":
      gte.setDate(gte.getDate() - 7);
      break;
    case "day":
      gte.setDate(gte.getDate() - 1);
      break;
    default:
      gte.setMonth(gte.getMonth() - 1); // month
  }

  return { gte, lte: now };
}

async function calculateProductionEfficiency(dateRange: {
  gte: Date;
  lte: Date;
}) {
  type EfficiencyResult = {
    target_daily: number;
    actual_daily: number;
    efficiency_rate: number;
  };
  const result = await prisma.$queryRaw<EfficiencyResult[]>`
    SELECT
      50 AS target_daily,
      AVG(daily_production) AS actual_daily,
      AVG(daily_production) / 50 * 100 AS efficiency_rate
    FROM (
      SELECT 
        DATE("endDate") AS day,
        SUM(quantity) AS daily_production
      FROM "ProductionBatch"
      WHERE "status" = 'COMPLETED'
        AND "endDate" BETWEEN ${dateRange.gte} AND ${dateRange.lte}
      GROUP BY DATE("endDate")
    ) daily_stats
  `;

  return {
    targetDaily: result[0]?.target_daily ?? 0,
    actualDaily: result[0]?.actual_daily ?? 0,
    efficiencyRate: result[0]?.efficiency_rate ?? 0,
  };
}

async function calculateCustomerSegments(dateRange: { gte: Date; lte: Date }) {
  const segments = await prisma.$queryRaw`
    SELECT
      CASE
        WHEN SUM(o.total) > 500000 THEN 'Enterprise'
        WHEN SUM(o.total) > 100000 THEN 'Medium Business'
        ELSE 'Small Orders'
      END AS segment,
      COUNT(DISTINCT c.id) AS customer_count,
      SUM(o.total) AS total_value
    FROM "Customer" c
    JOIN "Order" o ON c.id = o."customerId"
    WHERE o."status" = 'DELIVERED'
      AND o."updatedAt" BETWEEN ${dateRange.gte} AND ${dateRange.lte}
    GROUP BY segment
  `;

  return segments;
}

async function calculateRepeatCustomerMetrics(dateRange: {
  gte: Date;
  lte: Date;
}) {
  type MetricsResult = {
    repeat_customers: number;
    avg_order_value: number;
    lifetime_value: number;
  };
  const metrics = await prisma.$queryRaw<MetricsResult[]>`
    WITH customer_orders AS (
      SELECT
        c.id,
        COUNT(o.id) AS order_count,
        AVG(o.total) AS avg_order_value
      FROM "Customer" c
      JOIN "Order" o ON c.id = o."customerId"
      WHERE o."status" = 'DELIVERED'
        AND o."updatedAt" BETWEEN ${dateRange.gte} AND ${dateRange.lte}
      GROUP BY c.id
    )
    SELECT
      COUNT(id) FILTER (WHERE order_count > 1) AS repeat_customers,
      AVG(avg_order_value) AS avg_order_value,
      AVG(avg_order_value * 0.3 * order_count) AS lifetime_value
    FROM customer_orders
  `;

  const totalCustomers = await prisma.customer.count({
    where: {
      orders: {
        some: {
          status: "DELIVERED",
          updatedAt: dateRange,
        },
      },
    },
  });

  return {
    repeatCustomerRate:
      totalCustomers > 0 && metrics[0]?.repeat_customers
        ? (metrics[0].repeat_customers / totalCustomers) * 100
        : 0,
    avgOrderValue: metrics[0]?.avg_order_value || 0,
    customerLifetimeValue: metrics[0]?.lifetime_value || 0,
  };
}

export const getSalesReport = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { period = "month" } = req.query;
    const dateRange = getDateRange(period as string);

    const [salesTrends, topProducts] = await Promise.all([
      // Sales trends by month
      prisma.$queryRaw`
        SELECT
          DATE_TRUNC('month', o."updatedAt") AS month,
          SUM(o.total) AS revenue,
          COUNT(o.id) AS order_count
        FROM "Order" o
        WHERE o."status" = 'DELIVERED'
          AND o."updatedAt" BETWEEN ${dateRange.gte} AND ${dateRange.lte}
        GROUP BY DATE_TRUNC('month', o."updatedAt")
        ORDER BY month
      `,

      // Top selling products
      prisma.product.findMany({
        orderBy: { unitsSold: "desc" },
        take: 4,
      }),
    ]);

    successResponse(
      res,
      200,
      {
        salesTrends,
        topProducts: topProducts.map((p) => ({
          name: p.name,
          unitsSold: p.unitsSold,
        })),
      },
      "Sales report retrieved successfully"
    );
  } catch (error) {
    next(error);
  }
};

export const getProductionReport = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { period = "month" } = req.query;
    const dateRange = getDateRange(period as string);

    const [productionEfficiency, materialUsage] = await Promise.all([
      calculateProductionEfficiency(dateRange),

      // Material usage
      prisma.$queryRaw`
        SELECT
          rm.name,
          SUM(pm.quantity * pb.quantity) AS amount_used,
          rm.unit
        FROM "ProductionBatch" pb
        JOIN "ProductMaterial" pm ON pb."productId" = pm."productId"
        JOIN "RawMaterial" rm ON pm."rawMaterialId" = rm.id
        WHERE pb."status" = 'COMPLETED'
          AND pb."endDate" BETWEEN ${dateRange.gte} AND ${dateRange.lte}
        GROUP BY rm.id
      `,
    ]);

    successResponse(
      res,
      200,
      {
        productionEfficiency,
        materialUsage,
      },
      "Production report retrieved successfully"
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
    const inventoryStatus = await prisma.rawMaterial.findMany({
      orderBy: { stock: "asc" },
      select: {
        name: true,
        stock: true,
        status: true,
        unit: true,
        reorderLevel: true,
      },
    });

    successResponse(
      res,
      200,
      {
        lowStock: inventoryStatus.filter((i) => i.status === "LOW_STOCK"),
        outOfStock: inventoryStatus.filter((i) => i.status === "OUT_OF_STOCK"),
        healthyStock: inventoryStatus.filter((i) => i.status === "IN_STOCK"),
      },
      "Inventory report retrieved successfully"
    );
  } catch (error) {
    next(error);
  }
};

export const getCustomerAnalysis = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { period = "month" } = req.query;
    const dateRange = getDateRange(period as string);

    const [customerSegments, repeatCustomerMetrics] = await Promise.all([
      calculateCustomerSegments(dateRange),
      calculateRepeatCustomerMetrics(dateRange),
    ]);

    successResponse(
      res,
      200,
      {
        customerSegments,
        repeatCustomerMetrics,
      },
      "Customer analysis retrieved successfully"
    );
  } catch (error) {
    next(error);
  }
};
