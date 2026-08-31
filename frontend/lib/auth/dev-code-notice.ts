import { toast } from "sonner";

/**
 * Says out loud that no SMS was sent, and shows the code instead.
 *
 * The server only fills `devCode` outside production, and only when Eskiz
 * refused the message — an account still in test mode refuses every text but
 * its own three fixed ones. Without this the screen announced a delivery that
 * never happened and the code reached the server terminal alone, which reads
 * as "the SMS is lost" rather than "the SMS was never sent".
 */
export function notifyDevCode(devCode: string | undefined): void {
  if (!devCode) {
    return;
  }

  toast.warning(`SMS yuborilmadi (Eskiz test rejimi). Kod: ${devCode}`, { duration: 30_000 });
}
