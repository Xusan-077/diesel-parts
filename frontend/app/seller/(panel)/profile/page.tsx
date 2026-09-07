"use client";

import { LogOut } from "lucide-react";
import { useMe } from "@/hooks/seller/queries/use-me";
import { useLogout } from "@/hooks/seller/mutations/use-logout";
import { PageHeader } from "@/components/seller/page-header";
import { QueryErrorState } from "@/components/seller/query-error-state";
import { Button } from "@/components/seller/ui/button";
import { ROLE_LABEL } from "@/lib/seller/role-labels";
import { formatDate } from "@/lib/seller/format";

export default function SellerProfilePage() {
  const me = useMe();
  const logout = useLogout();

  return (
    <div>
      <PageHeader title="Profil" description="Hisob ma'lumotlaringiz." />

      <div className="mt-8 flex max-w-md flex-col gap-6">
        {me.isError ? (
          <QueryErrorState error={me.error} onRetry={() => me.refetch()} />
        ) : me.isLoading || !me.data ? (
          <div className="h-48 animate-pulse rounded-lg bg-surface-muted" />
        ) : (
          <dl className="panel grid gap-4">
            <div>
              <dt className="seller-eyebrow">Telefon</dt>
              <dd className="mt-0.5 font-mono text-sm text-foreground">{me.data.phone}</dd>
            </div>
            <div>
              <dt className="seller-eyebrow">Rol</dt>
              <dd className="mt-0.5 text-sm text-foreground">{ROLE_LABEL[me.data.role]}</dd>
            </div>
            {me.data.seller ? (
              <div>
                <dt className="seller-eyebrow">Sotuvchi ID</dt>
                <dd className="mt-0.5 font-mono text-sm text-foreground">{me.data.seller.id}</dd>
              </div>
            ) : null}
            <div>
              <dt className="seller-eyebrow">A&apos;zo bo&apos;lgan sana</dt>
              <dd className="mt-0.5 text-sm text-foreground">{formatDate(me.data.createdAt)}</dd>
            </div>
          </dl>
        )}

        <Button variant="danger" onClick={() => logout.mutate()} loading={logout.isPending} className="w-fit">
          <LogOut className="h-4 w-4" />
          Tizimdan chiqish
        </Button>
      </div>
    </div>
  );
}
