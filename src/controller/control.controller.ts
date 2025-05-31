import { Request, Response } from "express";
import { prisma } from "../utils/prisma";
import { NotFoundError, BadRequestError } from "../utils/error";

export const createControl = async (req: Request, res: Response) => {
  const { panelId, name, type, position, config, value } = req.body;

  const panel = await prisma.panel.findUnique({
    where: { id: panelId },
  });

  if (!panel) {
    throw new NotFoundError("Panel not found");
  }

  if (req.user!.role !== "ADMIN" && req.user!.role !== "SUPER_ADMIN") {
    const canEdit = await prisma.panelAssignment.findFirst({
      where: {
        panelId,
        userId: req.user!.id,
        canEdit: true,
      },
    });

    if (!canEdit) {
      throw new NotFoundError(
        "You do not have permission to add controls to this panel"
      );
    }
  }

  const control = await prisma.control.create({
    data: {
      panelId,
      name,
      type,
      position,
      config,
      value,
    },
  });

  res.status(201).json({ success: true, data: control });
};

export const getControlsForPanel = async (req: Request, res: Response) => {
  const { panelId } = req.params;

  if (req.user!.role !== "ADMIN" && req.user!.role !== "SUPER_ADMIN") {
    const hasAccess = await prisma.panelAssignment.findFirst({
      where: {
        panelId,
        userId: req.user!.id,
        canView: true,
      },
    });

    if (!hasAccess) {
      throw new NotFoundError("Panel not found");
    }
  }

  const controls = await prisma.control.findMany({
    where: { panelId },
    orderBy: {
      createdAt: "asc",
    },
  });

  res.json({ success: true, data: controls });
};

export const getControlById = async (req: Request, res: Response) => {
  const { id } = req.params;

  const control = await prisma.control.findUnique({
    where: { id },
    include: {
      logs: {
        orderBy: {
          timestamp: "desc",
        },
        take: 50,
      },
    },
  });

  if (!control) {
    throw new NotFoundError("Control not found");
  }

  if (req.user!.role !== "ADMIN" && req.user!.role !== "SUPER_ADMIN") {
    const hasAccess = await prisma.panelAssignment.findFirst({
      where: {
        panelId: control.panelId,
        userId: req.user!.id,
        canView: true,
      },
    });

    if (!hasAccess) {
      throw new NotFoundError("Control not found");
    }
  }

  res.json({ success: true, data: control });
};

export const updateControl = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, position, config, value, isActive } = req.body;

  const control = await prisma.control.findUnique({
    where: { id },
  });

  if (!control) {
    throw new NotFoundError("Control not found");
  }

  if (req.user!.role !== "ADMIN" && req.user!.role !== "SUPER_ADMIN") {
    const canEdit = await prisma.panelAssignment.findFirst({
      where: {
        panelId: control.panelId,
        userId: req.user!.id,
        canEdit: true,
      },
    });

    if (!canEdit) {
      throw new NotFoundError(
        "You do not have permission to edit this control"
      );
    }
  }

  const updatedControl = await prisma.control.update({
    where: { id },
    data: {
      name,
      position,
      config,
      value,
      isActive,
    },
  });

  if (req.body.value !== undefined && req.body.value !== control.value) {
    await prisma.controlLog.create({
      data: {
        controlId: id,
        oldValue: control.value,
        newValue: req.body.value,
        userId: req.user!.id,
        action: "UPDATED",
      },
    });
  }

  res.json({ success: true, data: updatedControl });
};

export const deleteControl = async (req: Request, res: Response) => {
  const { id } = req.params;

  const control = await prisma.control.findUnique({
    where: { id },
  });

  if (!control) {
    throw new NotFoundError("Control not found");
  }

  if (req.user!.role !== "ADMIN" && req.user!.role !== "SUPER_ADMIN") {
    const canEdit = await prisma.panelAssignment.findFirst({
      where: {
        panelId: control.panelId,
        userId: req.user!.id,
        canEdit: true,
      },
    });

    if (!canEdit) {
      throw new NotFoundError(
        "You do not have permission to delete this control"
      );
    }
  }

  await prisma.control.delete({
    where: { id },
  });

  res.json({ success: true, message: "Control deleted successfully" });
};

export const getControlLogs = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { limit = 50 } = req.query;

  const control = await prisma.control.findUnique({
    where: { id },
  });

  if (!control) {
    throw new NotFoundError("Control not found");
  }

  if (req.user!.role !== "ADMIN" && req.user!.role !== "SUPER_ADMIN") {
    const hasAccess = await prisma.panelAssignment.findFirst({
      where: {
        panelId: control.panelId,
        userId: req.user!.id,
        canView: true,
      },
    });

    if (!hasAccess) {
      throw new NotFoundError("Control not found");
    }
  }

  const logs = await prisma.controlLog.findMany({
    where: { controlId: id },
    orderBy: {
      timestamp: "desc",
    },
    take: Number(limit),
    include: {
      control: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
    },
  });

  res.json({ success: true, data: logs });
};
