import { describe, expect, it } from "vitest";
import {
  AGE_STEP_TEXT,
  ageStep,
  applyOverlay,
  dropPatch,
  formatAge,
  formatArrival,
  groupByColumn,
  hoursSince,
  movesFor,
  patchCard,
  pruneSettled,
  tashkentDayKey,
  type BoardCard,
} from "./inquiry-board-state";
import { INQUIRY_COLUMNS } from "@/lib/api/inquiry-board";

function card(overrides: Partial<BoardCard> = {}): BoardCard {
  return {
    id: "i1",
    customerName: "Sardor Aliyev",
    phone: "+998901234567",
    email: null,
    message: "Forsunka bormi?",
    productId: null,
    productSku: null,
    quantity: null,
    column: "new",
    assignedSellerName: null,
    notes: null,
    followUpAt: null,
    ageHours: 1,
    ageLabel: "1 soat",
    createdAtLabel: "18 avg, 14:30",
    savedCustomer: null,
    ...overrides,
  };
}

describe("patchCard", () => {
  it("merges into an existing patch instead of replacing it", () => {
    const first = patchCard({}, "i1", { notes: "Qo'ng'iroq qilindi" });
    const second = patchCard(first, "i1", { followUpAt: "2026-09-01" });

    expect(second.i1).toEqual({ notes: "Qo'ng'iroq qilindi", followUpAt: "2026-09-01" });
  });
});

describe("dropPatch", () => {
  it("removes the card's pending move", () => {
    const overlay = patchCard({}, "i1", { column: "claimed" });
    expect(dropPatch(overlay, "i1")).toEqual({});
  });

  it("returns the same overlay when there was nothing to drop", () => {
    const overlay = patchCard({}, "i1", { column: "claimed" });
    expect(dropPatch(overlay, "i2")).toBe(overlay);
  });
});

describe("applyOverlay", () => {
  it("shows the pending move on the card and leaves the rest alone", () => {
    const cards = [card({ id: "i1" }), card({ id: "i2" })];
    const overlay = patchCard({}, "i1", { column: "claimed", assignedSellerName: "Nodir" });

    const [moved, untouched] = applyOverlay(cards, overlay);

    expect(moved.column).toBe("claimed");
    expect(moved.assignedSellerName).toBe("Nodir");
    expect(untouched).toBe(cards[1]);
  });
});

describe("pruneSettled", () => {
  it("forgets a patch the server has caught up with", () => {
    const overlay = patchCard({}, "i1", { column: "claimed" });
    expect(pruneSettled(overlay, [card({ id: "i1", column: "claimed" })])).toEqual({});
  });

  it("keeps a patch the server has not confirmed yet", () => {
    const overlay = patchCard({}, "i1", { column: "claimed" });
    expect(pruneSettled(overlay, [card({ id: "i1", column: "new" })])).toBe(overlay);
  });

  it("keeps a patch when only part of it has landed", () => {
    const overlay = patchCard({}, "i1", { notes: "Bugun keladi", followUpAt: "2026-09-01" });
    const settled = pruneSettled(overlay, [
      card({ id: "i1", notes: "Bugun keladi", followUpAt: null }),
    ]);

    expect(settled).toBe(overlay);
  });

  it("forgets a patch for a card that has left the board", () => {
    // A lead another seller claimed drops out of this seller's listing. Holding
    // the optimistic claim would keep showing it as theirs forever.
    const overlay = patchCard({}, "i1", { column: "claimed" });
    expect(pruneSettled(overlay, [])).toEqual({});
  });
});

describe("groupByColumn", () => {
  it("returns every column, including the empty ones", () => {
    const columns = groupByColumn([card({ id: "i1", column: "won" })]);

    expect(Object.keys(columns).sort()).toEqual([...INQUIRY_COLUMNS].sort());
    expect(columns.won).toHaveLength(1);
    expect(columns.new).toEqual([]);
  });
});

describe("movesFor", () => {
  it("offers nothing on an unclaimed lead, because claiming is the only way out", () => {
    expect(movesFor("new")).toEqual([]);
  });

  it("leads with the next step and keeps the closing moves available", () => {
    const moves = movesFor("claimed");

    expect(moves.map((move) => move.status)).toEqual(["IN_PROGRESS", "WON", "LOST"]);
    expect(moves.filter((move) => move.primary)).toHaveLength(1);
  });

  it("reopens a closed lead into the working column, not back to new", () => {
    expect(movesFor("won")[0].column).toBe("in_progress");
    expect(movesFor("lost")[0].column).toBe("in_progress");
  });
});

describe("ageStep", () => {
  it("steps an unanswered lead from fresh to cold", () => {
    expect(ageStep(0.5, "new")).toBe("fresh");
    expect(ageStep(5, "new")).toBe("waiting");
    expect(ageStep(30, "new")).toBe("stale");
    expect(ageStep(100, "new")).toBe("cold");
  });

  it("warns on a claimed lead nobody has started", () => {
    expect(ageStep(100, "claimed")).toBe("cold");
  });

  it("goes quiet once someone is working it or it is closed", () => {
    expect(ageStep(100, "in_progress")).toBe("quiet");
    expect(ageStep(100, "won")).toBe("quiet");
    expect(ageStep(100, "lost")).toBe("quiet");
  });

  it("says the two urgent steps out loud, so colour is never the only carrier", () => {
    expect(AGE_STEP_TEXT.stale).not.toBeNull();
    expect(AGE_STEP_TEXT.cold).not.toBeNull();
  });
});

describe("formatAge", () => {
  it("uses the coarsest unit that still says something", () => {
    expect(formatAge(0.005)).toBe("hozir");
    expect(formatAge(0.5)).toBe("30 daqiqa");
    expect(formatAge(3.9)).toBe("3 soat");
    expect(formatAge(25)).toBe("1 kun");
    expect(formatAge(24 * 45)).toBe("1 oy");
  });
});

describe("hoursSince", () => {
  it("measures the wait in hours", () => {
    const created = new Date("2026-08-19T06:00:00.000Z");
    expect(hoursSince(created, new Date("2026-08-19T09:30:00.000Z"))).toBe(3.5);
  });

  it("never reports a negative age from a clock that ran backwards", () => {
    const created = new Date("2026-08-19T09:00:00.000Z");
    expect(hoursSince(created, new Date("2026-08-19T06:00:00.000Z"))).toBe(0);
  });
});

describe("formatArrival", () => {
  it("stamps the arrival on the seller's clock, not UTC", () => {
    // 22:10 UTC is already the next morning in Tashkent.
    expect(formatArrival(new Date("2026-08-18T22:10:00.000Z"))).toBe("19 avg, 03:10");
  });
});

describe("tashkentDayKey", () => {
  it("has already turned over while UTC is still on yesterday", () => {
    expect(tashkentDayKey(new Date("2026-08-19T20:00:00.000Z"))).toBe("2026-08-20");
  });
});
