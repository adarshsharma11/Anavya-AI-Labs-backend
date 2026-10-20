import crypto from "crypto";
import { argon2Verify, argon2id } from "hash-wasm";

type BunPassword = {
  hash: (password: string) => Promise<string>;
  verify: (password: string, hash: string) => Promise<boolean>;
};

function bunPassword(): BunPassword | undefined {
  const runtime = globalThis as { Bun?: { password?: BunPassword } };
  return runtime.Bun?.password;
}

export async function hashPassword(password: string) {
  const bun = bunPassword();
  if (bun) {
    return bun.hash(password);
  }

  return argon2id({
    password,
    salt: crypto.randomBytes(16),
    parallelism: 1,
    iterations: 2,
    memorySize: 65536,
    hashLength: 32,
    outputType: "encoded",
  });
}

export async function verifyPassword(password: string, hash: string) {
  const bun = bunPassword();
  if (bun) {
    return bun.verify(password, hash);
  }

  return argon2Verify({ password, hash });
}
