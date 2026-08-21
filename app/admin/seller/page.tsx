import { redirect } from "next/navigation";

/**
 * The seller's landing route.
 *
 * `adminHomePath` sends a seller to `/admin/seller` after login, and the board
 * is the first thing they need, so this forwards rather than becoming a second
 * screen between the two. Keeping the board at its own path leaves room for the
 * customers, orders and stock screens beside it.
 */
export default function SellerHomePage() {
  redirect("/admin/seller/inquiries");
}
