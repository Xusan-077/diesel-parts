"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CustomerCreateForm } from "./customer-create-form";

/**
 * The "add a customer" affordance on the list page.
 *
 * A client island around an otherwise server-rendered list: only the open/shut
 * state of the dialog needs the browser, so the table below it stays on the
 * server and keeps rendering from the same query the page already ran.
 *
 * The button no longer disappears when the form is open — it used to be
 * replaced by the form, which on this page meant the primary action vanished
 * from the header and reappeared as a card halfway down the screen.
 */
export function CustomerAdd() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        Mijoz qo&apos;shish
      </Button>

      {/* Mounted only while open, so each new customer starts from a blank
          form rather than from the last one's leftovers. */}
      {open ? (
        <CustomerCreateForm
          open
          onOpenChange={setOpen}
          onDone={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
