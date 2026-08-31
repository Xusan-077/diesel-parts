import type { Role } from "@/lib/api/seller-panel/types";

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: "Super admin",
  DIRECTOR: "Direktor",
  MANAGER: "Menejer",
  SELLER: "Sotuvchi",
  VIEWER: "Kuzatuvchi",
};
