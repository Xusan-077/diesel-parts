import { sellerApiRequest } from "./client";
import type {
  CashierShift,
  CloseShiftInput,
  CurrentCashierShift,
  OpenShiftInput,
} from "./types";

/** `null` when nothing is open — not a 404, see CashierService.current. */
export function fetchCurrentShift(): Promise<CurrentCashierShift | null> {
  return sellerApiRequest<CurrentCashierShift | null>(
    "/seller/cashier/shift/current",
  );
}

export function fetchShiftHistory(limit = 10): Promise<CashierShift[]> {
  return sellerApiRequest<CashierShift[]>("/seller/cashier/shift/history", {
    query: { limit },
  });
}

export function openShift(dto: OpenShiftInput): Promise<CashierShift> {
  return sellerApiRequest<CashierShift>("/seller/cashier/shift/open", {
    method: "POST",
    body: dto,
  });
}

export function closeShift(dto: CloseShiftInput): Promise<CashierShift> {
  return sellerApiRequest<CashierShift>("/seller/cashier/shift/close", {
    method: "POST",
    body: dto,
  });
}
