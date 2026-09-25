// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { ReturnEditor } from "./returns/return-form";
import { ReturnsTable } from "./returns-table";
import { CloseShiftForm } from "./cashier/close-shift-form";
import { OpenShiftDialog } from "./cashier/open-shift-dialog";
import { SellerApiError } from "@/lib/api/seller-panel/client";
import type { Order, CurrentCashierShift } from "@/lib/api/seller-panel/types";
const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  close: vi.fn(),
  open: vi.fn(),
  current: vi.fn(),
  push: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/hooks/seller/mutations/use-create-return", () => ({
  useCreateReturn: () => ({ mutateAsync: mocks.create, isPending: false }),
}));
vi.mock("@/hooks/seller/mutations/use-close-shift", () => ({
  useCloseShift: () => ({ mutateAsync: mocks.close, isPending: false }),
}));
vi.mock("@/hooks/seller/mutations/use-open-shift", () => ({
  useOpenShift: () => ({ mutateAsync: mocks.open, isPending: false }),
}));
vi.mock("@/lib/api/seller-panel/cashier", () => ({
  fetchCurrentShift: mocks.current,
}));
const shift = { id: "s1", expectedBalance: "100" } as CurrentCashierShift;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.current.mockResolvedValue(shift);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("return and cashier components", () => {
  it("renders an empty list and a retryable error without raw details", () => {
    const retry = vi.fn();
    const props = {
      returns: [],
      meta: undefined,
      isLoading: false,
      isError: false,
      onRetry: retry,
      onPageChange: vi.fn(),
    };
    const { rerender } = render(<ReturnsTable {...props} />);
    expect(screen.getByText("Qaytarishlar yo‘q")).toBeInTheDocument();
    rerender(
      <ReturnsTable
        {...props}
        isError
        error={new SellerApiError("SQL leaked", 500, "server")}
      />,
    );
    expect(screen.queryByText("SQL leaked")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Qayta urinish" }));
    expect(retry).toHaveBeenCalled();
  });
  it("computes a refund, allows adjustment, confirms, and displays backend validation inline", async () => {
    mocks.create.mockRejectedValue(
      new SellerApiError("raw", 409, "exceeds_purchased_qty"),
    );
    render(
      <ReturnEditor
        order={{ id: "o1" } as Order}
        lines={[
          {
            productId: "p1",
            sku: "F1",
            name: "Filter",
            unitPrice: 100,
            remainingQty: 2,
            purchasedQty: 2,
            alreadyReturnedQty: 0,
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Filter tanlash" }));
    const amount = screen.getByLabelText("Qaytarish summasi (so‘m)");
    expect(amount).toHaveValue(200);
    fireEvent.change(amount, { target: { value: "150" } });
    fireEvent.click(screen.getByRole("radio", { name: "Payme" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Qaytarishni yaratish" }),
    );
    const confirm = await screen.findByRole("alertdialog");
    expect(mocks.create).not.toHaveBeenCalled();
    fireEvent.click(
      within(confirm).getByRole("button", { name: "Tasdiqlash" }),
    );
    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith(
        expect.objectContaining({
          refundAmount: 150,
          refundMethod: "PAYME",
          orderId: "o1",
        }),
      ),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Miqdor sotuvda qolgan miqdordan oshdi",
    );
    expect(mocks.push).not.toHaveBeenCalled();
  });
  it("requires a comment for cash differences and confirms before close", async () => {
    mocks.close.mockResolvedValue({ id: "s1" });
    render(<CloseShiftForm shift={shift} />);
    fireEvent.change(screen.getByLabelText("Haqiqiy qoldiq (so‘m)"), {
      target: { value: "90" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Yopishni tasdiqlash" }),
    );
    expect(
      await screen.findByText("Farq sababini izohda yozing"),
    ).toBeInTheDocument();
    expect(mocks.close).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Izoh (majburiy)"), {
      target: { value: "Kamomad" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Yopishni tasdiqlash" }),
    );
    const confirm = await screen.findByRole("alertdialog");
    fireEvent.click(
      within(confirm).getByRole("button", { name: "Smenani yopish" }),
    );
    await waitFor(() =>
      expect(mocks.close).toHaveBeenCalledWith({
        closingBalanceActual: 90,
        comment: "Kamomad",
      }),
    );
  });
  it("requires re-review if expected balance changed", async () => {
    mocks.current.mockResolvedValue({ ...shift, expectedBalance: "110" });
    render(<CloseShiftForm shift={shift} />);
    fireEvent.change(screen.getByLabelText("Haqiqiy qoldiq (so‘m)"), {
      target: { value: "100" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Yopishni tasdiqlash" }),
    );
    expect(
      await screen.findByText(
        "Kutilgan qoldiq yangilandi. Summani tekshirib, qayta tasdiqlang.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(mocks.close).not.toHaveBeenCalled();
  });
  it("opens a shift only after confirmation", async () => {
    mocks.open.mockResolvedValue({ id: "s1" });
    render(<OpenShiftDialog open onOpenChange={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Boshlang‘ich summa (so‘m)"), {
      target: { value: "500" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Smenani ochish" }));
    const confirm = await screen.findByRole("alertdialog");
    expect(mocks.open).not.toHaveBeenCalled();
    fireEvent.click(
      within(confirm).getByRole("button", { name: "Tasdiqlash" }),
    );
    await waitFor(() =>
      expect(mocks.open).toHaveBeenCalledWith({ openingBalance: 500 }),
    );
  });
});
