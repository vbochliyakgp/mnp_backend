import { Request, Response } from "express";
import { prisma } from "../utils/prisma";
import { NotFoundError, BadRequestError } from "../utils/error";

export const getAllUsers = async (req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      username: true,
      firstName: true,
      lastName: true,
      phone: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  res.json({ success: true, data: users });
};

export const getUserById = async (req: Request, res: Response) => {
  const { id } = req.params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      username: true,
      firstName: true,
      lastName: true,
      phone: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      assignedPanels: {
        include: {
          panel: {
            select: {
              id: true,
              name: true,
              type: true,
              status: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    throw new NotFoundError("User not found");
  }

  res.json({ success: true, data: user });
};

export const updateUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { firstName, lastName, phone, role, isActive } = req.body;

  // Only admins can update roles
  if (role && req.user!.role !== "SUPER_ADMIN") {
    throw new BadRequestError("Only super admins can update roles");
  }

  // Users can only update their own profile unless they're admin
  if (
    id !== req.user!.id &&
    req.user!.role !== "ADMIN" &&
    req.user!.role !== "SUPER_ADMIN"
  ) {
    throw new BadRequestError("You can only update your own profile");
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      firstName,
      lastName,
      phone,
      ...(role && { role }),
      ...(isActive !== undefined && { isActive }),
    },
    select: {
      id: true,
      email: true,
      username: true,
      firstName: true,
      lastName: true,
      phone: true,
      role: true,
      isActive: true,
    },
  });

  res.json({ success: true, data: user });
};

export const deleteUser = async (req: Request, res: Response) => {
  const { id } = req.params;

  if (req.user!.role !== "SUPER_ADMIN") {
    throw new BadRequestError("Only super admins can delete users");
  }

  await prisma.user.delete({
    where: { id },
  });

  res.json({ success: true, message: "User deleted successfully" });
};
