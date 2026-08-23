"use client";

import { LogOut } from "lucide-react";
import { useMe } from "@/hooks/seller/queries/use-me";
import { useLogout } from "@/hooks/seller/mutations/use-logout";
import { QueryErrorState } from "@/components/seller/query-error-state";
import { Button } from "@/components/seller/ui/button";
import { ROLE_LABEL } from "@/lib/seller/role-labels";
import { formatDate } from "@/lib/seller/format";

export default function SellerProfilePage() {
  const me = useMe();
  const logout = useLogout();

  return (
    <div className="flex max-w-md flex-col gap-6">
      <h1 className="text-xl font-semibold text-foreground">Profil</h1>

      {me.isError ? (
        <QueryErrorState error={me.error} onRetry={() => me.refetch()} />
      ) : me.isLoading || !me.data ? (
        <div className="h-40 animate-pulse rounded-md bg-surface-muted" />
      ) : (
        <div className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
          <div>
            <p className="seller-eyebrow">Telefon</p>
            <p className="mt-0.5 font-mono text-sm text-foreground">{me.data.phone}</p>
          </div>
          <div>
            <p className="seller-eyebrow">Rol</p>
            <p className="mt-0.5 text-sm text-foreground">{ROLE_LABEL[me.data.role]}</p>
          </div>
          {me.data.seller ? (
            <div>
              <p className="seller-eyebrow">Sotuvchi ID</p>
              <p className="mt-0.5 font-mono text-sm text-foreground">{me.data.seller.id}</p>
            </div>
          ) : null}
          <div>
            <p className="seller-eyebrow">A&apos;zo bo&apos;lgan sana</p>
            <p className="mt-0.5 text-sm text-foreground">{formatDate(me.data.createdAt)}</p>
          </div>
        </div>
      )}

      <Button variant="danger" onClick={() => logout.mutate()} loading={logout.isPending} className="w-fit">
        <LogOut className="h-4 w-4" />
        Tizimdan chiqish
      </Button>
    </div>
  );
}
