import { hash, verify } from "@node-rs/argon2";

const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
};

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, ARGON2_OPTIONS);
}

export async function verifyPassword(plain: string, passwordHash: string): Promise<boolean> {
  try {
    return await verify(passwordHash, plain, ARGON2_OPTIONS);
  } catch {
    return false;
  }
}

export function isPasswordStrongEnough(password: string): boolean {
  return password.length >= 8;
}
