export class CustomError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: any
  ) {
    super(message);
    Object.setPrototypeOf(this, CustomError.prototype);
  }
}

export class BadRequestError extends CustomError {
  constructor(message: string, details?: any) {
    super(400, message, details);
  }
}

export class UnauthorizedError extends CustomError {
  constructor(message: string, details?: any) {
    super(401, message, details);
  }
}

export class ForbiddenError extends CustomError {
  constructor(message: string, details?: any) {
    super(403, message, details);
  }
}

export class NotFoundError extends CustomError {
  constructor(message: string, details?: any) {
    super(404, message, details);
  }
}

export class ConflictError extends CustomError {
  constructor(message: string, details?: any) {
    super(409, message, details);
  }
}

export class InternalServerError extends CustomError {
  constructor(message: string, details?: any) {
    super(500, message, details);
  }
}
