"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/shadcn/form";
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from "@/components/ui/shadcn/alert";
import { Card, CardContent } from "@/components/ui/shadcn/card";
import { Input } from "@/components/seller/ui/input";
import { Textarea } from "@/components/seller/ui/textarea";
import { Button } from "@/components/seller/ui/button";
import { ConfirmDialog } from "@/components/seller/ui/confirm-dialog";
import { useCloseShift } from "@/hooks/seller/mutations/use-close-shift";
import { fetchCurrentShift } from "@/lib/api/seller-panel/cashier";
import { actionErrorMessage } from "@/lib/seller/action-errors";
import { formatMoney } from "@/lib/seller/format";
import { balanceDifference, closingSchema } from "./shift-schema";
import type { CurrentCashierShift } from "@/lib/api/seller-panel/types";
export function CloseShiftForm({ shift }: { shift: CurrentCashierShift }) {
  const router = useRouter();
  const mutation = useCloseShift();
  const [confirm, setConfirm] = useState(false);
  const [checking, setChecking] = useState(false);
  const [expected, setExpected] = useState(Number(shift.expectedBalance));
  const form = useForm({
    resolver: zodResolver(closingSchema(expected)),
    defaultValues: { closingBalanceActual: Number.NaN, comment: "" },
  });
  const actual = useWatch({
    control: form.control,
    name: "closingBalanceActual",
  });
  const difference = balanceDifference(actual, expected);
  async function review() {
    setChecking(true);
    form.clearErrors("root");
    try {
      const fresh = await fetchCurrentShift();
      if (!fresh || fresh.id !== shift.id) {
        form.setError("root", {
          message: "Smena o‘zgargan. Kassa sahifasini yangilang.",
        });
        return;
      }
      const next = Number(fresh.expectedBalance);
      setExpected(next);
      if (next !== expected) {
        form.setError("root", {
          message:
            "Kutilgan qoldiq yangilandi. Summani tekshirib, qayta tasdiqlang.",
        });
        return;
      }
      setConfirm(true);
    } catch (error) {
      form.setError("root", { message: actionErrorMessage(error) });
    } finally {
      setChecking(false);
    }
  }
  async function submit() {
    if (!(await form.trigger())) {
      setConfirm(false);
      return;
    }
    try {
      await mutation.mutateAsync(form.getValues());
      setConfirm(false);
      router.push("/seller/cashier");
    } catch (error) {
      setConfirm(false);
      form.setError("root", { message: actionErrorMessage(error) });
    }
  }
  return (
    <Card className="max-w-2xl border-border bg-surface text-foreground shadow-none">
      <CardContent>
        <Form {...form}>
          <form
            noValidate
            onSubmit={form.handleSubmit(review)}
            className="space-y-6"
          >
            <div className="space-y-2">
              <label htmlFor="expected-balance" className="text-sm font-medium">
                Kutilgan qoldiq (so‘m)
              </label>
              <Input
                id="expected-balance"
                readOnly
                value={formatMoney(expected)}
                className="font-mono bg-surface-muted"
              />
            </div>
            <FormField
              control={form.control}
              name="closingBalanceActual"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Haqiqiy qoldiq (so‘m)</FormLabel>
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
            {Number.isFinite(difference) && (
              <Alert
                className={
                  difference < 0
                    ? "border-danger bg-danger-surface text-danger"
                    : "border-success bg-success-surface text-success"
                }
              >
                <AlertTitle>
                  Farq: {difference > 0 ? "+" : ""}
                  {formatMoney(difference)}
                </AlertTitle>
                <AlertDescription className="text-inherit">
                  {difference === 0
                    ? "Kassa qoldig‘i mos."
                    : difference > 0
                      ? "Kassada ortiqcha naqd pul bor. Sababini yozing."
                      : "Kassada kamomad bor. Sababini yozing."}
                </AlertDescription>
              </Alert>
            )}
            <FormField
              control={form.control}
              name="comment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Izoh{" "}
                    {Number.isFinite(difference) && difference !== 0
                      ? "(majburiy)"
                      : "(ixtiyoriy)"}
                  </FormLabel>
                  <FormControl>
                    <Textarea {...field} maxLength={2000} rows={4} />
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
            <Button type="submit" loading={checking || mutation.isPending}>
              Yopishni tasdiqlash
            </Button>
          </form>
        </Form>
        <ConfirmDialog
          open={confirm}
          onOpenChange={setConfirm}
          title="Smenani yopasizmi?"
          description={
            "Haqiqiy qoldiq: " +
            formatMoney(actual) +
            ". Farq: " +
            formatMoney(difference)
          }
          confirmLabel="Smenani yopish"
          loading={mutation.isPending}
          onConfirm={() => void submit()}
        />
      </CardContent>
    </Card>
  );
}
