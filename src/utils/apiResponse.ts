export const successResponse = (
  res: any,
  statusCode: number,
  data: any,
  message: string
) => {
  res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};
