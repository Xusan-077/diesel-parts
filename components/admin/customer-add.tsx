"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CustomerCreateForm } from "./customer-create-form";

/**
 * The "add a customer" affordance on the list page.
 *
 * A client island around an otherwise server-rendered list: only the open/shut
 * state of the form needs the browser, so the table below it stays on the
 * server and keeps rendering from the same query the page already ran.
 */
export function CustomerAdd() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        Mijoz qo&apos;shish
      </Button>
    );
  }

  return <CustomerCreateForm onDone={() => setOpen(false)} />;
}
