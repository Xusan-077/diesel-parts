// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CheckboxField } from "./checkbox";
import { controlVariants } from "./field-styles";
import { FormField } from "./form-field";
import { Input } from "./input";
import { Select } from "./select";
import { Textarea } from "./textarea";

afterEach(cleanup);

/** The control a field wrapped, found the way a screen reader finds it. */
function control(label: string): HTMLElement {
  return screen.getByLabelText(label);
}

describe("FormField", () => {
  it("labels the control without the call site inventing an id", () => {
    render(
      <FormField label="SKU">
        <Input defaultValue="DP-INJ-3126" />
      </FormField>,
    );

    expect((control("SKU") as HTMLInputElement).value).toBe("DP-INJ-3126");
  });

  it("keeps ids unique when the same field is rendered twice", () => {
    render(
      <>
        <FormField label="Ismi">
          <Input />
        </FormField>
        <FormField label="Telefon">
          <Input />
        </FormField>
      </>,
    );

    expect(control("Ismi").id).not.toBe(control("Telefon").id);
    expect(control("Ismi").id).not.toBe("");
  });

  it("points the control at its hint", () => {
    render(
      <FormField label="Narx" hint="Bo'sh qoldirilsa — so'rov bo'yicha">
        <Input />
      </FormField>,
    );

    const described = control("Narx").getAttribute("aria-describedby");
    expect(described).not.toBeNull();
    expect(document.getElementById(described as string)?.textContent).toBe(
      "Bo'sh qoldirilsa — so'rov bo'yicha",
    );
  });

  it("replaces the hint with the error and marks the control invalid", () => {
    const { rerender } = render(
      <FormField label="Narx" hint="Bo'sh qoldirilsa — so'rov bo'yicha">
        <Input />
      </FormField>,
    );
    expect(control("Narx").getAttribute("aria-invalid")).toBeNull();

    rerender(
      <FormField label="Narx" hint="Bo'sh qoldirilsa — so'rov bo'yicha" error="Faqat raqam">
        <Input />
      </FormField>,
    );

    // One slot, not two: the field's height does not change when it fails.
    expect(screen.queryByText("Bo'sh qoldirilsa — so'rov bo'yicha")).toBeNull();
    expect(screen.getByRole("alert").textContent).toBe("Faqat raqam");
    expect(control("Narx").getAttribute("aria-invalid")).toBe("true");
    expect(control("Narx").getAttribute("aria-describedby")).toBe(
      screen.getByRole("alert").id,
    );
  });

  it("inks the rail red on error instead of orange on focus", () => {
    const { container, rerender } = render(
      <FormField label="Narx">
        <Input />
      </FormField>,
    );
    /* The box, not the outer wrapper: the field is label / box / message now,
       and the rail travels with the box because the frame and the rail are one
       object — see `fieldBox`. */
    const box = () => container.querySelector("[class*='border-l-2']") as HTMLElement;
    expect(box().className).toContain("focus-within:border-accent-strong");

    rerender(
      <FormField label="Narx" error="Faqat raqam">
        <Input />
      </FormField>,
    );
    expect(box().className).toContain("border-danger");
    expect(box().className).not.toContain("focus-within:border-accent-strong");
  });

  it("marks a required field on the control, not in its name", () => {
    render(
      <FormField label="SKU" required>
        <Input />
      </FormField>,
    );

    // The asterisk is decoration. The requirement itself is the control's, so
    // the field stays findable by exactly the words printed above it.
    expect(screen.getByText("*").getAttribute("aria-hidden")).toBe("true");
    expect((control("SKU") as HTMLInputElement).required).toBe(true);
  });

  it("prints the unit inside the box rather than in the label", () => {
    render(
      <FormField label="Narx" suffix="so'm">
        <Input />
      </FormField>,
    );

    // Reached through the label, so the suffix cannot be what is labelling it.
    expect(control("Narx")).toBeTruthy();
    expect(screen.getByText("so'm")).toBeTruthy();
  });

  it("disables the control it wraps", () => {
    render(
      <FormField label="Slug" disabled>
        <Input />
      </FormField>,
    );

    expect((control("Slug") as HTMLInputElement).disabled).toBe(true);
  });

  it("lets an explicit prop beat the inherited one", () => {
    render(
      <FormField label="Slug" disabled>
        <Input disabled={false} />
      </FormField>,
    );

    expect((control("Slug") as HTMLInputElement).disabled).toBe(false);
  });

  it("wires a select and a textarea the same way as an input", () => {
    render(
      <>
        <FormField label="Rol" error="Rol tanlanmagan">
          <Select>
            <option value="SELLER">Sotuvchi</option>
          </Select>
        </FormField>
        <FormField label="Izoh" hint="Ixtiyoriy">
          <Textarea />
        </FormField>
      </>,
    );

    expect(control("Rol").tagName).toBe("SELECT");
    expect(control("Rol").getAttribute("aria-invalid")).toBe("true");
    expect(control("Izoh").tagName).toBe("TEXTAREA");
    expect(control("Izoh").getAttribute("aria-describedby")).not.toBeNull();
  });
});

describe("control variant", () => {
  it("drops its own frame inside a field and keeps one outside", () => {
    render(
      <>
        <FormField label="Ichkarida">
          <Input />
        </FormField>
        <Input aria-label="Tashqarida" />
      </>,
    );

    // Inside a field the rail is the only boundary — no second box, no shadow.
    expect(control("Ichkarida").className).toContain("border-0");
    // Standalone, the control has to draw its own, at the 3:1 a UI component
    // needs — `--field-border`, which holds that line in both palettes.
    expect(control("Tashqarida").className).toContain("border-field-border");
  });

  /*
   * The focus indicator belongs to exactly one element. Inside a field that is
   * the field, and the control has to stand down or the app's near-black ring
   * is drawn straight through the field's orange one — the control is inset by
   * the box's padding, so the two rectangles cross rather than nest.
   */
  it("hands the focus ring to the field it sits in", () => {
    render(
      <>
        <FormField label="Ichkarida">
          <Input />
        </FormField>
        <Input aria-label="Tashqarida" />
      </>,
    );

    expect(control("Ichkarida").className).toContain("focus:outline-none");
    // Standalone it draws the ring itself, so it drops the app's one too.
    expect(control("Tashqarida").className).toContain("focus:outline-none");
  });

  it("keeps the app's ring on a control that nothing else will mark", () => {
    // What a toolbar filter on a bare `fieldRail` wears: no field context, so
    // no `focus-within` box behind it, so the app ring is all it has.
    expect(controlVariants({ variant: "rail" })).not.toContain("outline-none");
  });
});

describe("CheckboxField", () => {
  it("labels the box and describes it with the hint", () => {
    render(
      <CheckboxField
        label="Katalogda ko'rinsin"
        hint="Belgi olib tashlansa mahsulot saytdan yo'qoladi"
        defaultChecked
      />,
    );

    const box = control("Katalogda ko'rinsin") as HTMLInputElement;
    expect(box.type).toBe("checkbox");
    expect(box.checked).toBe(true);
    expect(
      document.getElementById(box.getAttribute("aria-describedby") as string)?.textContent,
    ).toBe("Belgi olib tashlansa mahsulot saytdan yo'qoladi");
  });

  it("raises an error the same way a text field does", () => {
    render(<CheckboxField label="Hisob faol" error="Oxirgi direktorni o'chirib bo'lmaydi" />);

    expect(screen.getByRole("alert").textContent).toBe("Oxirgi direktorni o'chirib bo'lmaydi");
    expect(control("Hisob faol").getAttribute("aria-invalid")).toBe("true");
  });
});
