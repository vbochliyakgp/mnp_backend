import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "../../generated/prisma";
import { ApiError } from "../utils/apiError";
import { successResponse } from "../utils/apiResponse";
const prisma = new PrismaClient();

export const getInventorySummary = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const [rawMaterials, products, lowStockItems, topSellingProduct] =
      await Promise.all([
        prisma.rawMaterial.findMany(),
        prisma.product.findMany(),
        prisma.rawMaterial.count({
          where: {
            OR: [{ status: "LOW_STOCK" }, { status: "OUT_OF_STOCK" }],
          },
        }),
        prisma.product.findFirst({
          orderBy: { unitsSold: "desc" },
        }),
      ]);

    const totalRawMaterials = rawMaterials.reduce(
      (sum, item) => sum + item.stock,
      0
    );
    const finishedProducts = products.reduce(
      (sum, item) => sum + item.stock,
      0
    );

    successResponse(
      res,
      200,
      {
        totalRawMaterials,
        lowStockItems,
        topSellingProduct: topSellingProduct?.name,
        finishedProducts,
      },
      "Inventory summary retrieved successfully"
    );
  } catch (error) {
    next(error);
  }
};

export const addRawMaterial = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name, supplier, quantity, unit, price, gstRate, remarks } =
      req.body;

    if (!name || !quantity || !unit || !price) {
      throw new ApiError(400, "Name, quantity, unit, and price are required");
    }

    // Calculate total amount
    const totalAmount =
      parseFloat(price) *
      parseFloat(quantity) *
      (1 + (parseFloat(gstRate) || 0) / 100);

    // Generate item ID
    const lastMaterial = await prisma.rawMaterial.findFirst({
      orderBy: { itemId: "desc" },
    });
    const nextId = lastMaterial
      ? parseInt(lastMaterial.itemId.split("-")[1]) + 1
      : 1;
    const itemId = `RM-${nextId.toString().padStart(3, "0")}`;

    const rawMaterial = await prisma.rawMaterial.create({
      data: {
        itemId,
        name,
        supplier: supplier || null,
        stock: parseFloat(quantity),
        unit,
        price: parseFloat(price),
        status: parseFloat(quantity) > 0 ? "IN_STOCK" : "OUT_OF_STOCK",
        remarks: remarks || null,
      },
    });

    successResponse(res, 201, rawMaterial, "Raw material added successfully");
  } catch (error) {
    next(error);
  }
};

export const addFinishedProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      type,
      name,
      gsm,
      colorTop,
      colorBottom,
      width,
      length,
      weight,
      quantity,
      piecesPerBundle,
      variant,
      remarks,
      rollType,
      rollNumber,
    } = req.body;

    if (!type || !name || !quantity ) {
      throw new ApiError(400, "Type, name, and quantity are required");
    }

    const parsedQuantity = parseInt(quantity);

    let existingProduct;

    if (type === "ROLL") {
      existingProduct = await prisma.product.findFirst({
        where: {
          name,
          rollType,
          gsm: gsm ? parseInt(gsm) : undefined,
          colorTop,
          colorBottom,
          width: width ? parseFloat(width) : undefined,
        },
      });
    } else if (type === "BUNDLE") {
      existingProduct = await prisma.product.findFirst({
        where: {
          name,
          gsm: gsm ? parseInt(gsm) : undefined,
          colorTop,
          colorBottom,
          length: length ? parseFloat(length) : undefined,
          width: width ? parseFloat(width) : undefined,
        },
      });
    }

    if (existingProduct) {
      const updatedProduct = await prisma.product.update({
        where: { id: existingProduct.id },
        data: {
          stock: existingProduct.stock + parsedQuantity,
          status: existingProduct.stock + parsedQuantity > 0 ? "IN_STOCK" : "OUT_OF_STOCK",
        },
      });
      return successResponse(res, 200, updatedProduct, "Product stock updated successfully");
    }

    const prefix = type === "ROLL" ? "TR" : "TB";
    const lastProduct = await prisma.product.findFirst({
      where: { itemId: { startsWith: prefix } },
      orderBy: { itemId: "desc" },
    });

    const nextId = lastProduct
      ? parseInt(lastProduct.itemId.replace(prefix, "")) + 1
      : 1;

    const itemId = `${prefix}${nextId.toString().padStart(3, "0")}`;

    const productData: any = {
      itemId,
      name,
      type,
      category: "Tarpaulin",
      gsm: gsm ? parseInt(gsm) : 0,
      colorTop: colorTop || null,
      colorBottom: colorBottom || null,
      stock: parsedQuantity,
      status: parsedQuantity > 0 ? "IN_STOCK" : "OUT_OF_STOCK",
      variant: variant || null,
      remarks: remarks || null,
    };

    if (type === "ROLL") {
      Object.assign(productData, {
        width: width ? parseFloat(width) : null,
        length: length ? parseFloat(length) : null,
        weight: weight ? parseFloat(weight) : null,
        rollType: rollType || null,
        rollNumber: rollNumber ? parseInt(rollNumber) : null,
        unit: "rolls",
      });
    } else if (type === "BUNDLE") {
      Object.assign(productData, {
        width: width ? parseFloat(width) : null,
        length: length ? parseFloat(length) : null,
        weight: weight ? parseFloat(weight) : null,
        piecesPerBundle: piecesPerBundle ? parseInt(piecesPerBundle) : null,
        unit: "bundles",
      });
    }

    const newProduct = await prisma.product.create({ data: productData });

    return successResponse(res, 201, newProduct, "Finished product added successfully");
  } catch (error) {
    next(error);
  }
};


export const generateInventoryReport = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { category, status, startDate, endDate } = req.query;

    const where = {
      ...(category && category !== "All Categories" ? { category } : {}),
      ...(status && status !== "All Statuses" ? { status } : {}),
      ...(startDate && endDate
        ? {
            createdAt: {
              gte: new Date(startDate as string),
              lte: new Date(endDate as string),
            },
          }
        : {}),
    };

    const rawMaterials = await prisma.rawMaterial.findMany({
      orderBy: { name: "asc" },
    });

    const products = await prisma.product.findMany({
      orderBy: { name: "asc" },
    });

    successResponse(
      res,
      200,
      {
        rawMaterials,
        products,
      },
      "Inventory report generated successfully"
    );
  } catch (error) {
    next(error);
  }
};

export const getLowStockAlerts = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const alerts = await prisma.rawMaterial.findMany({
      where: {
        OR: [{ status: "LOW_STOCK" }, { status: "OUT_OF_STOCK" }],
      },
      orderBy: { stock: "asc" },
    });

    successResponse(
      res,
      200,
      alerts,
      "Low stock alerts retrieved successfully"
    );
  } catch (error) {
    next(error);
  }
};

export const getRawMaterials = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { search, status, page = 1, limit = 10 } = req.query;

    const where: any = {
      category: "Raw Material",
    };

    if (search) {
      where.OR = [
        { itemId: { contains: search as string, mode: "insensitive" } },
        { name: { contains: search as string, mode: "insensitive" } },
        { supplier: { contains: search as string, mode: "insensitive" } },
      ];
    }

    if (status && status !== "All Statuses") {
      where.status = status;
    }

    const [rawMaterials, totalCount] = await Promise.all([
      prisma.rawMaterial.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.rawMaterial.count({ where }),
    ]);

    successResponse(
      res,
      200,
      {
        rawMaterials,
        pagination: {
          total: totalCount,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(totalCount / Number(limit)),
        },
      },
      "Raw materials retrieved successfully"
    );
  } catch (error) {
    next(error);
  }
};

export const getFinishedProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { status, type, page = 1, limit = 10 } = req.query;

    const where: any = {
      category: "Tarpaulin",
    };

    // Status filter (from your UI)
    if (status && status !== "All Statuses") {
      where.status = status;
    }

    // Type filter (ROLL or BUNDLE - from your UI tabs)
    if (type && (type === "ROLL" || type === "BUNDLE")) {
      where.type = type;
    }

    const [products, totalCount] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.product.count({ where }),
    ]);

    successResponse(
      res,
      200,
      {
        products,
        pagination: {
          total: totalCount,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(totalCount / Number(limit)),
        },
      },
      "Finished products retrieved successfully"
    );
  } catch (error) {
    next(error);
  }
};

export const searchInventory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { query, category, status, page = 1, limit = 10 } = req.query;

    if (!query) {
      throw new ApiError(400, "Search query is required");
    }

    const where: any = {
      OR: [
        { itemId: { contains: query as string, mode: "insensitive" } },
        { name: { contains: query as string, mode: "insensitive" } },
        { supplier: { contains: query as string, mode: "insensitive" } },
        { type: { contains: query as string, mode: "insensitive" } },
      ],
    };

    if (category && category !== "All Categories") {
      where.category = category;
    }

    if (status && status !== "All Statuses") {
      where.status = status;
    }

    const [rawMaterials, products] = await Promise.all([
      prisma.rawMaterial.findMany({
        where: {
          ...where,
          category: "Raw Material",
        },
        orderBy: { name: "asc" },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.product.findMany({
        where: {
          ...where,
          category: "Finished Product",
        },
        orderBy: { name: "asc" },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
    ]);

    const totalCount = await Promise.all([
      prisma.rawMaterial.count({
        where: {
          ...where,
          category: "Raw Material",
        },
      }),
      prisma.product.count({
        where: {
          ...where,
          category: "Finished Product",
        },
      }),
    ]);

    const combinedTotal = totalCount.reduce((sum, count) => sum + count, 0);

    successResponse(
      res,
      200,
      {
        rawMaterials,
        products,
        pagination: {
          total: combinedTotal,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(combinedTotal / Number(limit)),
        },
      },
      "Inventory search results"
    );
  } catch (error) {
    next(error);
  }
};
