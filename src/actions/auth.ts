"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { signSession, sessionCookieName, sessionMaxAge, resolvePasswordHash } from "@/lib/auth";

const FAILURE_DELAY_MS = 500;

export interface LoginState {
  error?: string;
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const password = String(formData.get("password") ?? "");
  const hash = resolvePasswordHash(process.env.APP_PASSWORD_HASH);

  if (!hash) {
    return { error: "Server is missing APP_PASSWORD_HASH. See README." };
  }

  const ok = password.length > 0 && bcrypt.compareSync(password, hash);
  if (!ok) {
    // Constant-ish delay on failure. SPEC §10.
    await new Promise((r) => setTimeout(r, FAILURE_DELAY_MS));
    return { error: "Wrong password." };
  }

  const token = await signSession();
  const store = await cookies();
  store.set(sessionCookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: sessionMaxAge,
  });

  redirect("/");
}

export async function logout(): Promise<void> {
  const store = await cookies();
  store.delete(sessionCookieName);
  redirect("/login");
}
