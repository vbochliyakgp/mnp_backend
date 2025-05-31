import bcrypt from "bcryptjs";
import crypto from "crypto";

export const hashPassword = async (
  password: string
): Promise<{ hash: string; salt: string }> => {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = await bcrypt.hash(password + salt, parseInt("12"));
  return { hash, salt };
};

export const verifyPassword = async (
  password: string,
  hash: string,
  salt: string
): Promise<boolean> => {
  return bcrypt.compare(password + salt, hash);
};
