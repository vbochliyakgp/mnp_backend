import { Request, Response } from "express";
import { prisma } from "../utils/prisma";
import { NotFoundError, BadRequestError } from "../utils/error";

export const createFlow = async (req: Request, res: Response) => {
  const { panelId, name, description, flowData } = req.body;

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
        "You do not have permission to add flows to this panel"
      );
    }
  }

  const flow = await prisma.flow.create({
    data: {
      panelId,
      name,
      description,
      flowData,
    },
  });

  res.status(201).json({ success: true, data: flow });
};

export const getFlowsForPanel = async (req: Request, res: Response) => {
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

  const flows = await prisma.flow.findMany({
    where: { panelId },
    include: {
      executions: {
        take: 3,
        orderBy: {
          startTime: "desc",
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  res.json({ success: true, data: flows });
};

export const getFlowById = async (req: Request, res: Response) => {
  const { id } = req.params;

  const flow = await prisma.flow.findUnique({
    where: { id },
    include: {
      executions: {
        orderBy: {
          startTime: "desc",
        },
        take: 10,
        include: {
          steps: {
            orderBy: {
              startTime: "desc",
            },
            take: 20,
          },
        },
      },
    },
  });

  if (!flow) {
    throw new NotFoundError("Flow not found");
  }

  if (req.user!.role !== "ADMIN" && req.user!.role !== "SUPER_ADMIN") {
    const hasAccess = await prisma.panelAssignment.findFirst({
      where: {
        panelId: flow.panelId,
        userId: req.user!.id,
        canView: true,
      },
    });

    if (!hasAccess) {
      throw new NotFoundError("Flow not found");
    }
  }

  res.json({ success: true, data: flow });
};

export const updateFlow = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description, flowData, status, isActive } = req.body;

  const flow = await prisma.flow.findUnique({
    where: { id },
  });

  if (!flow) {
    throw new NotFoundError("Flow not found");
  }

  if (req.user!.role !== "ADMIN" && req.user!.role !== "SUPER_ADMIN") {
    const canEdit = await prisma.panelAssignment.findFirst({
      where: {
        panelId: flow.panelId,
        userId: req.user!.id,
        canEdit: true,
      },
    });

    if (!canEdit) {
      throw new NotFoundError("You do not have permission to edit this flow");
    }
  }

  const updatedFlow = await prisma.flow.update({
    where: { id },
    data: {
      name,
      description,
      flowData,
      status,
      isActive,
      version: flow.version + 1,
    },
  });

  res.json({ success: true, data: updatedFlow });
};

export const deleteFlow = async (req: Request, res: Response) => {
  const { id } = req.params;

  const flow = await prisma.flow.findUnique({
    where: { id },
  });

  if (!flow) {
    throw new NotFoundError("Flow not found");
  }

  if (req.user!.role !== "ADMIN" && req.user!.role !== "SUPER_ADMIN") {
    const canEdit = await prisma.panelAssignment.findFirst({
      where: {
        panelId: flow.panelId,
        userId: req.user!.id,
        canEdit: true,
      },
    });

    if (!canEdit) {
      throw new NotFoundError("You do not have permission to delete this flow");
    }
  }

  await prisma.flow.delete({
    where: { id },
  });

  res.json({ success: true, message: "Flow deleted successfully" });
};

export const executeFlow = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { input } = req.body;

  const flow = await prisma.flow.findUnique({
    where: { id },
  });

  if (!flow) {
    throw new NotFoundError("Flow not found");
  }

  if (req.user!.role !== "ADMIN" && req.user!.role !== "SUPER_ADMIN") {
    const canEdit = await prisma.panelAssignment.findFirst({
      where: {
        panelId: flow.panelId,
        userId: req.user!.id,
        canEdit: true,
      },
    });

    if (!canEdit) {
      throw new NotFoundError(
        "You do not have permission to execute this flow"
      );
    }
  }

  const execution = await prisma.flowExecution.create({
    data: {
      flowId: id,
      status: "PENDING",
      input,
    },
  });

  // In a real application, you would queue the flow execution
  // and process it asynchronously
  // For now, we'll simulate a successful execution

  setTimeout(async () => {
    await prisma.flowExecution.update({
      where: { id: execution.id },
      data: {
        status: "COMPLETED",
        endTime: new Date(),
        duration: 1000,
        output: { result: "Flow executed successfully" },
      },
    });
  }, 1000);

  res.json({ success: true, data: execution });
};

export const getFlowExecutions = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { limit = 10 } = req.query;

  const flow = await prisma.flow.findUnique({
    where: { id },
  });

  if (!flow) {
    throw new NotFoundError("Flow not found");
  }

  if (req.user!.role !== "ADMIN" && req.user!.role !== "SUPER_ADMIN") {
    const hasAccess = await prisma.panelAssignment.findFirst({
      where: {
        panelId: flow.panelId,
        userId: req.user!.id,
        canView: true,
      },
    });

    if (!hasAccess) {
      throw new NotFoundError("Flow not found");
    }
  }

  const executions = await prisma.flowExecution.findMany({
    where: { flowId: id },
    include: {
      steps: {
        orderBy: {
          startTime: "desc",
        },
        take: 5,
      },
    },
    orderBy: {
      startTime: "desc",
    },
    take: Number(limit),
  });

  res.json({ success: true, data: executions });
};
