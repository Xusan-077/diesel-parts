// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReviewForm } from "./review-form";
import { REVIEW_BODY_MAX, REVIEW_BODY_MIN, type PublicReview } from "@/lib/reviews";
import dictionary from "@/dictionaries/uz.json";

const toastError = vi.fn();
vi.mock("sonner", () => ({ toast: { error: (...args: unknown[]) => toastError(...args) } }));

const dict = dictionary.reviews;
const VALID_BODY = "320D ga o'rnatdim, uch oydan beri muammosiz ishlayapti.";

const own: PublicReview = {
  id: "r-1",
  rating: 4,
  body: "Avvalgi fikrim",
  authorName: "Anvar",
  createdAt: "2026-03-02T00:00:00.000Z",
  isMine: true,
};

function renderForm(overrides: { own?: PublicReview | null; submitting?: boolean } = {}) {
  const onSubmit = vi.fn().mockResolvedValue(true);
  render(
    <ReviewForm
      own={overrides.own ?? null}
      dict={dict}
      submitting={overrides.submitting ?? false}
      onSubmit={onSubmit}
    />
  );
  return onSubmit;
}

/*
 * Plain DOM assertions rather than jest-dom: this project does not install it,
 * and one suite reaching for `toBeChecked` would be the only place in the
 * codebase where a matcher exists.
 */
const star = (n: number): HTMLInputElement =>
  screen.getByRole("radio", {
    name: dict.ratingOption.replace("{n}", String(n)),
  }) as HTMLInputElement;

const field = (label: string): HTMLInputElement | HTMLTextAreaElement =>
  screen.getByLabelText(label) as HTMLInputElement | HTMLTextAreaElement;

afterEach(() => {
  cleanup();
  toastError.mockReset();
});

describe("ReviewForm rating input", () => {
  /*
   * Built on real radios precisely so this works without being reimplemented.
   * If it ever regresses to buttons, this is the test that says so.
   */
  it("exposes five radio options in one group", () => {
    renderForm();
    expect(screen.getAllByRole("radio")).toHaveLength(5);
  });

  it("selects the star that was clicked", async () => {
    renderForm();
    await userEvent.click(star(4));

    expect(star(4).checked).toBe(true);
    expect(star(3).checked).toBe(false);
  });

  /*
   * Arrow-key navigation is the browser's, not this component's — jsdom does
   * not emulate roving focus in a radio group, so there is nothing here to
   * assert it against. What can be asserted is the precondition that earns it:
   * five real radios sharing one name. Reimplement this as buttons with
   * `role="radio"` and that stops being true, which is what this catches.
   */
  it("keeps all five options in one native radio group", () => {
    renderForm();
    const names = new Set(screen.getAllByRole("radio").map((input) => (input as HTMLInputElement).name));

    expect(names.size).toBe(1);
    expect(screen.getAllByRole("radio").map((input) => input.tagName)).toEqual(
      Array(5).fill("INPUT")
    );
  });
});

describe("ReviewForm validation", () => {
  it("refuses a submission with no rating and says which field", async () => {
    const onSubmit = renderForm();

    await userEvent.type(field(dict.bodyLabel), VALID_BODY);
    await userEvent.type(field(dict.nameLabel), "Anvar");
    await userEvent.click(screen.getByRole("button", { name: dict.submit }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect((await screen.findByRole("alert")).textContent).toBe(dict.errorRating);
    expect(toastError).toHaveBeenCalledWith(dict.errorRating);
  });

  it("refuses a body under the floor", async () => {
    const onSubmit = renderForm();

    await userEvent.click(star(5));
    await userEvent.type(field(dict.nameLabel), "Anvar");
    await userEvent.type(field(dict.bodyLabel), "zo'r");
    await userEvent.click(screen.getByRole("button", { name: dict.submit }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByText(dict.errorBodyShort.replace("{min}", String(REVIEW_BODY_MIN)))
    ).toBeDefined();
  });

  /*
   * A form that is already red before anyone has typed tells the reader they
   * are wrong for arriving.
   */
  it("says nothing until the first attempt", () => {
    renderForm();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("submits a complete draft", async () => {
    const onSubmit = renderForm();

    await userEvent.click(star(5));
    await userEvent.type(field(dict.nameLabel), "Anvar");
    await userEvent.type(field(dict.bodyLabel), VALID_BODY);
    await userEvent.click(screen.getByRole("button", { name: dict.submit }));

    expect(onSubmit).toHaveBeenCalledWith({
      rating: 5,
      body: VALID_BODY,
      authorName: "Anvar",
    });
  });

  it("counts what has been typed against the ceiling", async () => {
    renderForm();
    await userEvent.type(field(dict.bodyLabel), "abc");

    expect(
      screen.getByText(
        dict.bodyCounter.replace("{count}", "3").replace("{max}", String(REVIEW_BODY_MAX))
      )
    ).toBeDefined();
  });
});

describe("ReviewForm when this person already reviewed the part", () => {
  /*
   * One row per person per part, so a second visit is an edit. Showing an
   * empty form that the server would refuse is a dead end in a control they
   * are looking at.
   */
  it("seeds from what they wrote and offers to update it", () => {
    renderForm({ own });

    expect(screen.getByRole("heading", { level: 3 }).textContent).toBe(dict.formTitleEditing);
    expect(field(dict.nameLabel).value).toBe("Anvar");
    expect(field(dict.bodyLabel).value).toBe("Avvalgi fikrim");
    expect(star(4).checked).toBe(true);
    expect(screen.getByRole("button", { name: dict.submitEditing })).toBeDefined();
  });
});

describe("ReviewForm while sending", () => {
  it("locks every control so one click cannot become two reviews", () => {
    renderForm({ submitting: true });

    const button = screen.getByRole("button", { name: dict.submitting }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(field(dict.bodyLabel).disabled).toBe(true);
    // The stars are disabled by their fieldset, and `.disabled` reflects an
    // element's own attribute rather than an inherited one. `:disabled` is the
    // property that accounts for the ancestor.
    expect(star(3).matches(":disabled")).toBe(true);
  });
});
