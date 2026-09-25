// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { useReturns } from "./queries/use-returns";
import { useReturn } from "./queries/use-return";
import { useCurrentShift } from "./queries/use-current-shift";
import { useSaleReturns } from "./queries/use-sale-returns";
import { useShiftHistory } from "./queries/use-shift-history";
import { useCreateReturn } from "./mutations/use-create-return";
import { useOpenShift } from "./mutations/use-open-shift";
import { useCloseShift } from "./mutations/use-close-shift";
import * as returnsApi from "@/lib/api/seller-panel/returns";
import * as cashierApi from "@/lib/api/seller-panel/cashier";
import { SellerApiError } from "@/lib/api/seller-panel/client";
vi.mock("@/lib/api/seller-panel/returns", () => ({
  fetchReturns: vi.fn(),
  fetchReturn: vi.fn(),
  createReturn: vi.fn(),
}));
vi.mock("@/lib/api/seller-panel/cashier", () => ({
  fetchCurrentShift: vi.fn(),
  fetchShiftHistory: vi.fn(),
  openShift: vi.fn(),
  closeShift: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
let client: QueryClient;
function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
beforeEach(() => {
  vi.resetAllMocks();
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});
afterEach(() => {
  cleanup();
  client.clear();
});
describe("seller return/shift hooks", () => {
  it("forwards filters, detail ids, current-shift null and history limits", async () => {
    vi.mocked(returnsApi.fetchReturns).mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
    vi.mocked(returnsApi.fetchReturn).mockResolvedValue({ id: "r1" } as Awaited<
      ReturnType<typeof returnsApi.fetchReturn>
    >);
    vi.mocked(cashierApi.fetchCurrentShift).mockResolvedValue(null);
    vi.mocked(cashierApi.fetchShiftHistory).mockResolvedValue([]);
    const filters = { search: "Ali", status: "COMPLETED" as const, page: 1 };
    const result = renderHook(
      () => ({
        list: useReturns(filters),
        detail: useReturn("r1"),
        current: useCurrentShift(),
        history: useShiftHistory(10),
      }),
      { wrapper },
    );
    await waitFor(() =>
      expect(
        result.result.current.detail.isSuccess &&
          result.result.current.history.isSuccess,
      ).toBe(true),
    );
    expect(returnsApi.fetchReturns).toHaveBeenCalledWith(filters);
    expect(returnsApi.fetchReturn).toHaveBeenCalledWith("r1");
    expect(result.result.current.current.data).toBeNull();
    expect(cashierApi.fetchShiftHistory).toHaveBeenCalledWith(10);
  });
  it("loads every page of previous returns before enabling quantity selection", async () => {
    vi.mocked(returnsApi.fetchReturns)
      .mockResolvedValueOnce({
        data: [{ id: "r1" }],
        meta: { totalPages: 2 },
      } as Awaited<ReturnType<typeof returnsApi.fetchReturns>>)
      .mockResolvedValueOnce({
        data: [{ id: "r2" }],
        meta: { totalPages: 2 },
      } as Awaited<ReturnType<typeof returnsApi.fetchReturns>>);
    const { result } = renderHook(() => useSaleReturns("o1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
    expect(returnsApi.fetchReturns).toHaveBeenLastCalledWith({
      orderId: "o1",
      page: 2,
      limit: 100,
    });
  });
  it("creates a return, toasts success and invalidates stock, orders, returns and cash", async () => {
    vi.mocked(returnsApi.createReturn).mockResolvedValue({
      id: "r1",
      returnNumber: "RET-1",
    } as Awaited<ReturnType<typeof returnsApi.createReturn>>);
    const invalidates = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useCreateReturn(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({
        orderId: "o1",
        refundMethod: "PAYME",
        refundAmount: 10,
        items: [],
      });
    });
    expect(toast.success).toHaveBeenCalled();
    for (const key of ["returns", "orders", "cashier", "inventory", "products"])
      expect(invalidates).toHaveBeenCalledWith({ queryKey: ["seller", key] });
  });
  it("opens/closes shifts, invalidates cashier and translates failures", async () => {
    vi.mocked(cashierApi.openShift).mockResolvedValue({ id: "s1" } as Awaited<
      ReturnType<typeof cashierApi.openShift>
    >);
    vi.mocked(cashierApi.closeShift).mockResolvedValue({ id: "s1" } as Awaited<
      ReturnType<typeof cashierApi.closeShift>
    >);
    const invalidates = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(
      () => ({ open: useOpenShift(), close: useCloseShift() }),
      { wrapper },
    );
    await act(async () => {
      await result.current.open.mutateAsync({ openingBalance: 100 });
      await result.current.close.mutateAsync({ closingBalanceActual: 100 });
    });
    expect(toast.success).toHaveBeenCalledTimes(2);
    expect(invalidates).toHaveBeenCalledWith({
      queryKey: ["seller", "cashier"],
    });
    vi.mocked(cashierApi.closeShift).mockRejectedValue(
      new SellerApiError("raw exception", 400, "shift_comment_required"),
    );
    await act(async () => {
      await result.current.close
        .mutateAsync({ closingBalanceActual: 90 })
        .catch(() => {});
    });
    expect(toast.error).toHaveBeenCalledWith(
      "Kassadagi farq sababini izohda yozing.",
    );
  });
});
