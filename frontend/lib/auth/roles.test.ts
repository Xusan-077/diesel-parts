import { describe, expect, it } from "vitest";
import { PANEL_ROOT, STAFF_LOGIN_PATH } from "./roles";

describe("roles", () => {
  it("names the one staff login path", () => {
    expect(STAFF_LOGIN_PATH).toBe("/director/login");
  });

  it("names the merged panel root", () => {
    expect(PANEL_ROOT).toBe("/panel");
  });
});
