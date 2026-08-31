// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CheckoutDetailsForm } from "./checkout-details-form";
import { EMPTY_PROFILE } from "@/lib/account/profile";
import dictionary from "@/dictionaries/uz.json";

afterEach(cleanup);

const dict = dictionary.checkout;

function setup() {
  const onSubmit = vi.fn();
  render(
    <CheckoutDetailsForm formId="checkout-form" dict={dict} profile={EMPTY_PROFILE} onSubmit={onSubmit} />,
  );
  return { onSubmit };
}

function submitForm() {
  const form = document.getElementById("checkout-form") as HTMLFormElement;
  fireEvent.submit(form);
}

describe("CheckoutDetailsForm", () => {
  it("blocks submit and shows required errors when the customer fields are empty", async () => {
    const { onSubmit } = setup();

    submitForm();

    expect(await screen.findAllByText(dict.errorRequired)).not.toHaveLength(0);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("reveals address fields only after DELIVERY is chosen", async () => {
    const user = userEvent.setup();
    setup();

    expect(screen.queryByLabelText(dict.cityLabel)).not.toBeInTheDocument();

    await user.click(screen.getByText(dict.deliveryDeliveryLabel));

    expect(screen.getByLabelText(dict.cityLabel)).toBeInTheDocument();
  });

  it("requires city/district/street once DELIVERY is chosen", async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup();

    await user.type(screen.getByLabelText(dict.firstNameLabel), "Aziz");
    await user.type(screen.getByLabelText(dict.lastNameLabel), "Karimov");
    await user.click(screen.getByText(dict.deliveryDeliveryLabel));
    await user.click(screen.getByLabelText(dict.termsLabel));

    submitForm();

    expect(await screen.findAllByText(dict.errorRequired)).not.toHaveLength(0);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits a complete pickup order", async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup();

    await user.type(screen.getByLabelText(dict.firstNameLabel), "Aziz");
    await user.type(screen.getByLabelText(dict.lastNameLabel), "Karimov");
    await user.click(screen.getByLabelText(dict.termsLabel));

    submitForm();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      firstName: "Aziz",
      lastName: "Karimov",
      deliveryMethod: "PICKUP",
      termsAccepted: true,
      paymentMethod: "ONLINE",
    });
  });

  it("blocks submit until the terms checkbox is accepted", async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup();

    await user.type(screen.getByLabelText(dict.firstNameLabel), "Aziz");
    await user.type(screen.getByLabelText(dict.lastNameLabel), "Karimov");

    submitForm();

    expect(await screen.findByText(dict.errorTermsRequired)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
