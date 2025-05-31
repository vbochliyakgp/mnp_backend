import { Response } from "express";
import { AuthRequest } from "../types";
import {
  PrismaClient,
  Product,
  RawMaterial,
} from "../../generated/prisma/client";

const prisma = new PrismaClient();

export const getInventory = async (req: AuthRequest, res: Response) => {
  try {
    const { type = "all" } = req.query;

    let rawMaterials = <RawMaterial[]>[];
    let products = <Product[]>[];

    if (type === "all" || type === "raw") {
      rawMaterials = await prisma.rawMaterial.findMany({
        orderBy: { name: "asc" },
      });
    }

    if (type === "all" || type === "finished") {
      products = await prisma.product.findMany({
        orderBy: { name: "asc" },
      });
    }

    // Get low stock alerts
    const lowStockMaterials = await prisma.rawMaterial.findMany({
      where: {
        status: "LOW_STOCK",
      },
    });

    const lowStockProducts = await prisma.product.findMany({
      where: {
        status: "LOW_STOCK",
      },
    });

    res.json({
      rawMaterials,
      products,
      alerts: {
        lowStockMaterials: lowStockMaterials.length,
        lowStockProducts: lowStockProducts.length,
      },
    });
  } catch (error) {
    console.error("Get inventory error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updateStock = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { stock, type } = req.body;

    if (type === "raw") {
      await prisma.rawMaterial.update({
        where: { id },
        data: { stock: parseFloat(stock) },
      });
    } else {
      await prisma.product.update({
        where: { id },
        data: { stock: parseInt(stock) },
      });
    }

    res.json({ message: "Stock updated successfully" });
  } catch (error) {
    console.error("Update stock error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
