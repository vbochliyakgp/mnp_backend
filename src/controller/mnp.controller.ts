import { Request, Response } from "express";
import { prisma } from "../utils/prisma";
import { NotFoundError, BadRequestError } from "../utils/error";

export const createMNPRequest = async (req: Request, res: Response) => {
  const {
    mobileNumber,
    currentOperator,
    requestedOperator,
    customerName,
    customerEmail,
    customerAddress,
    idProof,
    idProofNumber,
    priority,
  } = req.body;

  const existingRequest = await prisma.mNPRequest.findFirst({
    where: { mobileNumber },
  });

  if (existingRequest) {
    throw new BadRequestError("MNP request already exists for this number");
  }

  const request = await prisma.mNPRequest.create({
    data: {
      requestId: `MNP-${Date.now()}`,
      mobileNumber,
      currentOperator,
      requestedOperator,
      customerName,
      customerEmail,
      customerAddress,
      idProof,
      idProofNumber,
      priority,
      createdById: req.user!.id,
    },
  });

  // Create initial status history
  await prisma.mNPStatusHistory.create({
    data: {
      requestId: request.id,
      fromStatus: "PENDING",
      toStatus: "PENDING",
      changedBy: req.user!.id,
    },
  });

  res.status(201).json({ success: true, data: request });
};

export const getMNPRequests = async (req: Request, res: Response) => {
  const { status, priority } = req.query;

  const where: any = {};

  if (status) where.status = status;
  if (priority) where.priority = priority;

  // Non-admin users can only see their own requests
  if (req.user!.role !== "ADMIN" && req.user!.role !== "SUPER_ADMIN") {
    where.createdById = req.user!.id;
  }

  const requests = await prisma.mNPRequest.findMany({
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
      history: {
        orderBy: {
          changedAt: "desc",
        },
        take: 5,
      },
    },
    orderBy: {
      requestDate: "desc",
    },
  });

  res.json({ success: true, data: requests });
};

export const getMNPRequestById = async (req: Request, res: Response) => {
  const { id } = req.params;

  const request = await prisma.mNPRequest.findUnique({
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
      history: {
        orderBy: {
          changedAt: "desc",
        },
        include: {
          mnpRequest: {
            select: {
              requestId: true,
              mobileNumber: true,
            },
          },
        },
      },
      documents: {
        orderBy: {
          uploadedAt: "desc",
        },
      },
    },
  });

  if (!request) {
    throw new NotFoundError("MNP request not found");
  }

  // Non-admin users can only see their own requests
  if (
    req.user!.role !== "ADMIN" &&
    req.user!.role !== "SUPER_ADMIN" &&
    request.createdById !== req.user!.id
  ) {
    throw new NotFoundError("MNP request not found");
  }

  res.json({ success: true, data: request });
};

export const updateMNPRequestStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, comments } = req.body;

  const request = await prisma.mNPRequest.findUnique({
    where: { id },
  });

  if (!request) {
    throw new NotFoundError("MNP request not found");
  }

  // Only admins can update status
  if (req.user!.role !== "ADMIN" && req.user!.role !== "SUPER_ADMIN") {
    throw new BadRequestError("Only admins can update MNP request status");
  }

  const updatedRequest = await prisma.mNPRequest.update({
    where: { id },
    data: {
      status,
      ...(status === "PROCESSING" && { processedDate: new Date() }),
      ...(status === "COMPLETED" && { completionDate: new Date() }),
    },
  });

  // Create status history
  await prisma.mNPStatusHistory.create({
    data: {
      requestId: id,
      fromStatus: request.status,
      toStatus: status,
      changedBy: req.user!.id,
      comments,
    },
  });

  res.json({ success: true, data: updatedRequest });
};

export const uploadMNPDocument = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { fileName, fileType, fileSize, filePath } = req.body;

  const request = await prisma.mNPRequest.findUnique({
    where: { id },
  });

  if (!request) {
    throw new NotFoundError("MNP request not found");
  }

  // Only request creator or admin can upload documents
  if (
    req.user!.role !== "ADMIN" &&
    req.user!.role !== "SUPER_ADMIN" &&
    request.createdById !== req.user!.id
  ) {
    throw new BadRequestError(
      "You do not have permission to upload documents for this request"
    );
  }

  const document = await prisma.mNPDocument.create({
    data: {
      requestId: id,
      fileName,
      fileType,
      fileSize,
      filePath,
    },
  });

  res.status(201).json({ success: true, data: document });
};
