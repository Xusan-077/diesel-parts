import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/dal";
import { getCustomer, listCustomerInquiries } from "@/lib/api/customer-repository";
import { listOrders } from "@/lib/api/order-repository";
import { inquiryColumn } from "@/lib/api/inquiry-board";
import { formatSum } from "@/lib/analytics/format";
import { formatArrival } from "@/lib/admin/inquiry-board-state";
import { mailtoHref, telHref, whatsappHref } from "@/lib/admin/contact-links";
import {
  mergeTimeline,
  summariseValue,
  type TimelineInquiry,
  type TimelineOrder,
} from "@/lib/admin/customer-timeline";
import { buttonVariants } from "@/components/ui/button";
import { ClaimCustomerButton } from "@/components/admin/claim-customer-button";
import { CustomerNotes } from "@/components/admin/customer-notes";
import { CustomerTimelineList } from "@/components/admin/customer-timeline-list";

/* Contact hand-offs stay anchors — see the note on `buttonVariants`. */
const contactLink = buttonVariants({ variant: "outline", size: "sm" });

const EYEBROW = "type-eyebrow text-muted";

/**
 * One account, and everything that has happened on it.
 *
 * The two histories the brief asks for come from different places and are
 * joined differently: orders hang off `Customer.id`, while inquiries have no
 * customer foreign key at all — a lead is raised by an anonymous visitor long
 * before anyone knows whose account it is — so they are matched on the phone
 * number and the heading says so. Both are then merged into one column, because
 * "what is the story here" is one question.
 */
export default async function SellerCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireStaff();
  const { id } = await params;

  const customer = await getCustomer(id, user);
  if (customer === null) {
    notFound();
  }

  const [orderPage, inquiries] = await Promise.all([
    listOrders(user, { customerId: id, page: 1 }),
    listCustomerInquiries(customer.phone, user),
  ]);

  const orderEntries: TimelineOrder[] = orderPage.items.map((order) => ({
    kind: "order",
    id: order.id,
    at: order.createdAt.getTime(),
    dateLabel: formatArrival(order.createdAt),
    status: order.status,
    orderNumber: order.orderNumber,
    itemCount: order.itemCount,
    totalAmount: order.totalAmount,
    discountPercent: order.discountApprovedPercent,
    notes: order.notes,
    sellerName: order.sellerName,
  }));

  const inquiryEntries: TimelineInquiry[] = inquiries.map((inquiry) => ({
    kind: "inquiry",
    id: inquiry.id,
    at: inquiry.createdAt.getTime(),
    dateLabel: formatArrival(inquiry.createdAt),
    column: inquiryColumn(inquiry.status, inquiry.assignedSellerId),
    message: inquiry.message,
    productSku: inquiry.productSku,
    quantity: inquiry.quantity,
    notes: inquiry.notes,
    sellerName: inquiry.assignedSellerName,
  }));

  const timeline = mergeTimeline(inquiryEntries, orderEntries);
  const value = summariseValue(orderEntries);

  const pooled = customer.assignedSellerId === null;
  // A director may edit any account; a seller only their own. Reading a pooled
  // account is allowed so it can be claimed — writing to one is not.
  const editable = user.role === "DIRECTOR" || customer.assignedSellerId === user.id;

  const tel = telHref(customer.phone);
  const whatsapp = whatsappHref(customer.phone);
  const mail = mailtoHref(customer.email, "Diesel Parts");

  return (
    <div>
      <Link
        href="/admin/seller/customers"
        className="text-xs text-muted transition-colors hover:text-foreground"
      >
        ← Mijozlar
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="type-page text-foreground">
            {customer.name}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {customer.company ?? "Kompaniya ko'rsatilmagan"}
            {pooled ? (
              <span className="ml-2 rounded-full bg-surface-muted px-2 py-1 text-xs">
                egasiz
              </span>
            ) : customer.assignedSellerName !== null && user.role === "DIRECTOR" ? (
              <span className="ml-2 text-xs">{customer.assignedSellerName}</span>
            ) : null}
          </p>
        </div>

        {pooled ? <ClaimCustomerButton customerId={customer.id} /> : null}
      </div>

      <section className="mt-8">
        <h2 className={EYEBROW}>Aloqa</h2>

        <dl className="mt-3 grid gap-x-8 gap-y-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted">Telefon</dt>
            <dd className="mt-1">
              <a
                href={tel ?? undefined}
                className="font-mono text-sm tabular-nums text-foreground hover:underline"
              >
                {customer.phone}
              </a>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Email</dt>
            <dd className="mt-1 text-sm text-foreground">{customer.email ?? "—"}</dd>
          </div>
        </dl>

        <div className="mt-4 flex flex-wrap gap-2">
          {tel === null ? null : (
            <a href={tel} className={contactLink}>
              Qo&apos;ng&apos;iroq
            </a>
          )}
          {whatsapp === null ? null : (
            <a href={whatsapp} target="_blank" rel="noreferrer" className={contactLink}>
              WhatsApp
            </a>
          )}
          {mail === null ? null : (
            <a href={mail} className={contactLink}>
              Email
            </a>
          )}
        </div>
      </section>

      {/* Money the account has actually brought in, kept apart from money that
          is only promised. A single "lifetime value" adding drafts to closed
          business would be a figure a seller could raise by typing. */}
      <section className="mt-8">
        <h2 className={EYEBROW}>Hisob</h2>

        <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-4">
          <div>
            <dt className="text-xs text-muted">Yopilgan buyurtmalar</dt>
            <dd className="mt-1 font-mono text-lg tabular-nums text-foreground">
              {formatSum(value.earned)}
              <span className="ml-2 text-xs text-muted">{value.completedCount} ta</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Jarayondagilar</dt>
            <dd className="mt-1 font-mono text-lg tabular-nums text-muted">
              {formatSum(value.open)}
              <span className="ml-2 text-xs">{value.openCount} ta</span>
            </dd>
          </div>
        </dl>

        {orderPage.total > orderPage.items.length ? (
          <p className="mt-3 text-xs text-muted">
            Jami {orderPage.total} ta buyurtma — quyida oxirgi {orderPage.items.length} tasi.
          </p>
        ) : null}
      </section>

      <section className="mt-8">
        <h2 className={EYEBROW}>Izoh</h2>
        <div className="mt-3 max-w-2xl">
          <CustomerNotes customerId={customer.id} notes={customer.notes} editable={editable} />
          {editable || customer.notes !== null ? null : (
            <p className="text-sm text-muted">Izoh yo&apos;q.</p>
          )}
        </div>
      </section>

      <section className="mt-8">
        <h2 className={EYEBROW}>Tarix</h2>
        <p className="mt-2 max-w-prose text-xs text-muted">
          Buyurtmalar shu mijoz kartasiga bog&apos;langan. So&apos;rovlar esa telefon raqami
          bo&apos;yicha topilgan — saytdan kelgan so&apos;rov hech qaysi kartaga
          bog&apos;lanmaydi.
        </p>

        {timeline.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            Hali hech narsa bo&apos;lmagan. Birinchi so&apos;rov yoki buyurtma shu yerda
            paydo bo&apos;ladi.
          </p>
        ) : (
          <CustomerTimelineList entries={timeline} />
        )}
      </section>
    </div>
  );
}
