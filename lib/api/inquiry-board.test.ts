import { describe, expect, it } from "vitest";
import { INQUIRY_COLUMNS, inquiryColumn, inquiryColumnFilter } from "./inquiry-board";

describe("inquiryColumn", () => {
  it("puts an unassigned NEW lead in Yangi", () => {
    expect(inquiryColumn("NEW", null)).toBe("new");
  });

  it("puts an assigned NEW lead in Band qilingan", () => {
    // The whole reason the enum needs no fifth value: claiming is what moves a
    // card between the first two columns, and the assignee already records it.
    expect(inquiryColumn("NEW", "seller-1")).toBe("claimed");
  });

  it("maps the three remaining statuses regardless of assignee", () => {
    expect(inquiryColumn("IN_PROGRESS", "seller-1")).toBe("in_progress");
    expect(inquiryColumn("IN_PROGRESS", null)).toBe("in_progress");
    expect(inquiryColumn("WON", "seller-1")).toBe("won");
    expect(inquiryColumn("LOST", null)).toBe("lost");
  });

  it("covers all five board columns", () => {
    const produced = new Set([
      inquiryColumn("NEW", null),
      inquiryColumn("NEW", "seller-1"),
      inquiryColumn("IN_PROGRESS", null),
      inquiryColumn("WON", null),
      inquiryColumn("LOST", null),
    ]);

    expect([...produced].sort()).toEqual([...INQUIRY_COLUMNS].sort());
  });
});

describe("inquiryColumnFilter", () => {
  it("splits the two NEW columns on the assignee", () => {
    expect(inquiryColumnFilter("new")).toEqual({ status: "NEW", assignedSellerId: null });
    expect(inquiryColumnFilter("claimed")).toEqual({
      status: "NEW",
      assignedSellerId: { not: null },
    });
  });

  it("filters the other three on status alone", () => {
    expect(inquiryColumnFilter("in_progress")).toEqual({ status: "IN_PROGRESS" });
    expect(inquiryColumnFilter("won")).toEqual({ status: "WON" });
    expect(inquiryColumnFilter("lost")).toEqual({ status: "LOST" });
  });

  it("round-trips: every filter selects rows its own column would bucket back", () => {
    for (const column of INQUIRY_COLUMNS) {
      const filter = inquiryColumnFilter(column);
      const assignee = filter.assignedSellerId === null ? null : "seller-1";
      expect(inquiryColumn(filter.status, assignee)).toBe(column);
    }
  });
});
