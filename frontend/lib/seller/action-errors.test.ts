import { expect, it } from "vitest";
import { SellerApiError } from "@/lib/api/seller-panel/client";
import { actionErrorMessage } from "./action-errors";
it("never exposes raw server errors", () => {
  const error = new SellerApiError(
    "SQL SELECT password FROM users",
    500,
    "Internal Server Error",
  );
  expect(actionErrorMessage(error)).not.toContain("SQL");
  expect(
    actionErrorMessage(new SellerApiError("raw", 409, "exceeds_purchased_qty")),
  ).toContain("Miqdor");
});
