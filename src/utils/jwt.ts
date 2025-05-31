import jwt, { SignOptions } from "jsonwebtoken";
import { JWTPayload } from "../types";

export const generateAccessToken = (payload: JWTPayload): string => {
  const options: SignOptions = {
    expiresIn: "15m" as jwt.SignOptions["expiresIn"],
  };
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET as string, options);
};

export const generateRefreshToken = (payload: JWTPayload): string => {
  const options: SignOptions = {
    expiresIn: "7d" as jwt.SignOptions["expiresIn"],
  };
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET as string, options);
};

export const verifyAccessToken = (token: string): JWTPayload => {
  return jwt.verify(
    token,
    process.env.JWT_ACCESS_SECRET as string
  ) as JWTPayload;
};

export const verifyRefreshToken = (token: string): JWTPayload => {
  return jwt.verify(
    token,
    process.env.JWT_REFRESH_SECRET as string
  ) as JWTPayload;
};
