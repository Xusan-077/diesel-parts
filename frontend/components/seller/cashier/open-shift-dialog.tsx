"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog } from "@/components/seller/ui/dialog";
import { ConfirmDialog } from "@/components/seller/ui/confirm-dialog";
import { Input } from "@/components/seller/ui/input";
import { Button } from "@/components/seller/ui/button";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/shadcn/form";
import { useOpenShift } from "@/hooks/seller/mutations/use-open-shift";
import { actionErrorMessage } from "@/lib/seller/action-errors";
import { formatMoney } from "@/lib/seller/format";
import { openingSchema } from "./shift-schema";
export function OpenShiftDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const mutation = useOpenShift();
  const [confirm, setConfirm] = useState(false);
  const form = useForm({
    resolver: zodResolver(openingSchema),
    defaultValues: { openingBalance: 0 },
  });
  async function submit() {
    if (!(await form.trigger())) {
      setConfirm(false);
      return;
    }
    try {
      await mutation.mutateAsync(form.getValues());
      setConfirm(false);
      onOpenChange(false);
      form.reset();
    } catch (error) {
      setConfirm(false);
      form.setError("root", { message: actionErrorMessage(error) });
    }
  }
  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!mutation.isPending) {
            onOpenChange(next);
            form.reset();
          }
        }}
        title="Smenani ochish"
        description="Kassadagi boshlang‘ich naqd pul miqdorini kiriting."
      >
        <Form {...form}>
          <form
            noValidate
            onSubmit={form.handleSubmit(() => setConfirm(true))}
            className="space-y-5"
          >
            <FormField
              control={form.control}
              name="openingBalance"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Boshlang‘ich summa (so‘m)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={Number.isNaN(field.value) ? "" : field.value}
                      type="number"
                      min={0}
                      step="0.01"
                      onChange={(e) =>
                        field.onChange(
                          e.target.value === "" ? NaN : Number(e.target.value),
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {form.formState.errors.root && (
              <p role="alert" className="text-sm text-danger">
                {form.formState.errors.root.message}
              </p>
            )}
            <Button
              type="submit"
              className="w-full"
              loading={mutation.isPending}
            >
              Smenani ochish
            </Button>
          </form>
        </Form>
      </Dialog>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Smenani ochasizmi?"
        description={
          "Boshlang‘ich qoldiq: " +
          formatMoney(form.getValues("openingBalance"))
        }
        loading={mutation.isPending}
        onConfirm={() => void submit()}
      />
    </>
  );
}
