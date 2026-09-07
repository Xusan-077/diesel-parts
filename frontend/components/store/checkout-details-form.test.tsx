// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CheckoutDetailsForm } from "./checkout-details-form";
import { EMPTY_PROFILE } from "@/lib/account/profile";
import dictionary from "@/dictionaries/uz.json";

afterEach(cleanup);

const dict = dictionary.checkout;
const footerDict = dictionary.footer;

function setup(props?: Partial<Parameters<typeof CheckoutDetailsForm>[0]>) {
  const onSubmit = vi.fn();
  render(
    <CheckoutDetailsForm
      formId="checkout-form"
      dict={dict}
      footerDict={footerDict}
      profile={EMPTY_PROFILE}
      onSubmit={onSubmit}
      {...props}
    />,
  );
  return { onSubmit };
}

function submitForm() {
  const form = document.getElementById("checkout-form") as HTMLFormElement;
  fireEvent.submit(form);
}

async function fillCustomer(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(dict.firstNameLabel), "Aziz");
  await user.type(screen.getByLabelText(dict.lastNameLabel), "Karimov");
  await user.type(screen.getByLabelText(dict.phoneLabel), "901234567");
}

describe("CheckoutDetailsForm", () => {
  it("blocks submit and shows required errors when the customer fields are empty", async () => {
    const { onSubmit } = setup();

    submitForm();

    expect(await screen.findAllByText(dict.errorRequired)).not.toHaveLength(0);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows the pickup address instead of address fields by default", () => {
    setup();

    expect(screen.getByText(footerDict.address)).toBeInTheDocument();
    expect(screen.queryByLabelText(dict.regionLabel)).not.toBeInTheDocument();
  });

  it("reveals address fields only after DELIVERY is chosen", async () => {
    const user = userEvent.setup();
    setup();

    expect(screen.queryByLabelText(dict.regionLabel)).not.toBeInTheDocument();

    await user.click(screen.getByText(dict.deliveryDeliveryLabel));

    expect(screen.getByLabelText(dict.regionLabel)).toBeInTheDocument();
    expect(screen.getByLabelText(dict.districtLabel)).toBeInTheDocument();
    expect(screen.getByLabelText(dict.streetLabel)).toBeInTheDocument();
  });

  it("requires region/district/street once DELIVERY is chosen", async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup();

    await fillCustomer(user);
    await user.click(screen.getByText(dict.deliveryDeliveryLabel));
    await user.click(screen.getByLabelText(dict.termsLabel));

    submitForm();

    expect(await screen.findAllByText(dict.errorRequired)).not.toHaveLength(0);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("offers cash only for pickup, not delivery", async () => {
    const user = userEvent.setup();
    setup();

    expect(screen.getByText(dict.paymentCashLabel)).toBeInTheDocument();

    await user.click(screen.getByText(dict.deliveryDeliveryLabel));

    expect(screen.queryByText(dict.paymentCashLabel)).not.toBeInTheDocument();
  });

  it("explains the seller-agreement option when it is picked", async () => {
    const user = userEvent.setup();
    setup();

    expect(screen.queryByText(dict.paymentAgreementNote)).not.toBeInTheDocument();

    await user.click(screen.getByText(dict.paymentAgreementLabel));

    expect(screen.getByText(dict.paymentAgreementNote)).toBeInTheDocument();
  });

  it("reports the delivery and payment choices upward", async () => {
    const user = userEvent.setup();
    const onChoicesChange = vi.fn();
    setup({ onChoicesChange });

    await user.click(screen.getByText(dict.deliveryDeliveryLabel));
    await user.click(screen.getByText(dict.paymentAgreementLabel));

    await waitFor(() =>
      expect(onChoicesChange).toHaveBeenLastCalledWith({
        deliveryMethod: "DELIVERY",
        paymentMethod: "SELLER_AGREEMENT",
      }),
    );
  });

  it("submits a complete pickup order", async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup();

    await fillCustomer(user);
    await user.click(screen.getByLabelText(dict.termsLabel));

    submitForm();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      firstName: "Aziz",
      lastName: "Karimov",
      phone: "90 123 45 67",
      deliveryMethod: "PICKUP",
      termsAccepted: true,
      paymentMethod: "ONLINE",
    });
  });

  it("blocks submit until a valid phone is entered", async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup();

    await user.type(screen.getByLabelText(dict.firstNameLabel), "Aziz");
    await user.type(screen.getByLabelText(dict.lastNameLabel), "Karimov");
    await user.click(screen.getByLabelText(dict.termsLabel));
    await user.type(screen.getByLabelText(dict.phoneLabel), "90 12");

    submitForm();

    expect(await screen.findByText(dict.errorInvalidPhone)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("pre-fills the phone field from the session number", () => {
    setup({ defaultPhone: "998901234567" });

    expect(screen.getByLabelText(dict.phoneLabel)).toHaveValue("90 123 45 67");
  });

  it("shows a saved profile as a summary with an edit affordance", async () => {
    const user = userEvent.setup();
    setup({
      profile: { ...EMPTY_PROFILE, firstName: "Aziz", lastName: "Karimov" },
      defaultPhone: "998901234567",
    });

    expect(screen.getByText("Aziz Karimov")).toBeInTheDocument();
    expect(screen.queryByLabelText(dict.firstNameLabel)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: dict.customerEditCta }));

    expect(screen.getByLabelText(dict.firstNameLabel)).toHaveValue("Aziz");
  });

  it("blocks submit until the terms checkbox is accepted", async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup();

    await fillCustomer(user);

    submitForm();

    expect(await screen.findByText(dict.errorTermsRequired)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
