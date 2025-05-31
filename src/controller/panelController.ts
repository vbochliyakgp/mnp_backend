import { Request, Response } from "express";
import { prisma } from "../utils/prisma";
import { NotFoundError, BadRequestError } from "../utils/error";

export const createPanel = async (req: Request, res: Response) => {
  const { name, description, type, config, status, priority } = req.body;

  const panel = await prisma.panel.create({
    data: {
      name,
      description,
      type,
      config,
      status,
      priority,
      createdById: req.user!.id,
    },
    include: {
      createdBy: {
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  res.status(201).json({ success: true, data: panel });
};

export const getPanels = async (req: Request, res: Response) => {
  const { type, status } = req.query;

  const where: any = {};

  if (type) where.type = type;
  if (status) where.status = status;

  if (req.user!.role !== "ADMIN" && req.user!.role !== "SUPER_ADMIN") {
    where.assignments = {
      some: {
        userId: req.user!.id,
        canView: true,
      },
    };
  }

  const panels = await prisma.panel.findMany({
    where,
    include: {
      createdBy: {
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
        },
      },
      _count: {
        select: {
          controls: true,
          flows: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  res.json({ success: true, data: panels });
};

export const getPanelById = async (req: Request, res: Response) => {
  const { id } = req.params;

  const panel = await prisma.panel.findUnique({
    where: { id },
    include: {
      createdBy: {
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
        },
      },
      assignments: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
        },
      },
      controls: true,
      flows: {
        include: {
          executions: {
            take: 5,
            orderBy: {
              startTime: "desc",
            },
          },
        },
      },
      metrics: {
        orderBy: {
          timestamp: "desc",
        },
        take: 100,
      },
    },
  });

  if (!panel) {
    throw new NotFoundError("Panel not found");
  }

  if (req.user!.role !== "ADMIN" && req.user!.role !== "SUPER_ADMIN") {
    const hasAccess = await prisma.panelAssignment.findFirst({
      where: {
        panelId: id,
        userId: req.user!.id,
        canView: true,
      },
    });

    if (!hasAccess) {
      throw new NotFoundError("Panel not found");
    }
  }

  res.json({ success: true, data: panel });
};

export const updatePanel = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description, config, status, priority } = req.body;

  if (req.user!.role !== "ADMIN" && req.user!.role !== "SUPER_ADMIN") {
    const canEdit = await prisma.panelAssignment.findFirst({
      where: {
        panelId: id,
        userId: req.user!.id,
        canEdit: true,
      },
    });

    if (!canEdit) {
      throw new NotFoundError(
        "Panel not found or you do not have edit permissions"
      );
    }
  }

  const panel = await prisma.panel.update({
    where: { id },
    data: {
      name,
      description,
      config,
      status,
      priority,
    },
  });

  res.json({ success: true, data: panel });
};

export const deletePanel = async (req: Request, res: Response) => {
  const { id } = req.params;

  const panel = await prisma.panel.findUnique({
    where: { id },
  });

  if (!panel) {
    throw new NotFoundError("Panel not found");
  }

  if (req.user!.role !== "SUPER_ADMIN" && panel.createdById !== req.user!.id) {
    throw new NotFoundError("You do not have permission to delete this panel");
  }

  await prisma.panel.delete({
    where: { id },
  });

  res.json({ success: true, message: "Panel deleted successfully" });
};

export const assignPanelToUser = async (req: Request, res: Response) => {
  const { panelId } = req.params;
  const { userId, canEdit, canView } = req.body;

  const panel = await prisma.panel.findUnique({
    where: { id: panelId },
  });

  if (!panel) {
    throw new NotFoundError("Panel not found");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new NotFoundError("User not found");
  }

  if (req.user!.role !== "SUPER_ADMIN" && panel.createdById !== req.user!.id) {
    throw new NotFoundError("You do not have permission to assign this panel");
  }

  const assignment = await prisma.panelAssignment.upsert({
    where: {
      panelId_userId: {
        panelId,
        userId,
      },
    },
    update: {
      canEdit,
      canView,
    },
    create: {
      panelId,
      userId,
      canEdit,
      canView,
    },
  });

  res.json({ success: true, data: assignment });
};

export const getPanelMetrics = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { metricKey, startDate, endDate } = req.query;

  const where: any = {
    panelId: id,
  };

  if (metricKey) where.metricKey = metricKey;
  if (startDate && endDate) {
    where.timestamp = {
      gte: new Date(startDate as string),
      lte: new Date(endDate as string),
    };
  }

  const metrics = await prisma.panelMetric.findMany({
    where,
    orderBy: {
      timestamp: "asc",
    },
  });

  res.json({ success: true, data: metrics });
};
