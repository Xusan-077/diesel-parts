import { sellerApiRequest } from "./client";
import type { LoginResponse, MeResponse } from "./types";

export function login(phone: string, password: string): Promise<LoginResponse> {
  return sellerApiRequest<LoginResponse>("/auth/login", {
    method: "POST",
    body: { phone, password },
    skipAuthRetry: true,
  });
}

/** Relies on the httpOnly refresh_token cookie; never called with a token in JS. */
export function refresh(): Promise<LoginResponse> {
  return sellerApiRequest<LoginResponse>("/auth/refresh", {
    method: "POST",
    skipAuthRetry: true,
  });
}

export function logout(): Promise<{ success: boolean }> {
  return sellerApiRequest<{ success: boolean }>("/auth/logout", { method: "POST" });
}

export function me(): Promise<MeResponse> {
  return sellerApiRequest<MeResponse>("/auth/me");
}
