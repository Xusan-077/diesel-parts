// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CheckboxField } from "./checkbox";
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
    const rail = () => container.firstElementChild as HTMLElement;
    expect(rail().className).toContain("focus-within:border-accent-strong");

    rerender(
      <FormField label="Narx" error="Faqat raqam">
        <Input />
      </FormField>,
    );
    expect(rail().className).toContain("border-danger");
    expect(rail().className).not.toContain("focus-within:border-accent-strong");
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
    // Standalone, the control has to draw its own, at the 3:1 a UI component needs.
    expect(control("Tashqarida").className).toContain("border-border-strong");
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
