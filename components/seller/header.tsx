"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Bell, LogOut } from "lucide-react";
import { useSellerAuthStore } from "@/lib/store/seller-auth-store";
import { useNotifications } from "@/hooks/seller/queries/use-notifications";
import { useMarkNotificationRead } from "@/hooks/seller/mutations/use-mark-notification-read";
import { useLogout } from "@/hooks/seller/mutations/use-logout";
import { ROLE_LABEL } from "@/lib/seller/role-labels";
import { formatDateTime } from "@/lib/seller/format";
import { cn } from "@/lib/utils";

export function Header() {
  const user = useSellerAuthStore((s) => s.user);
  const { data: notifications } = useNotifications();
  const markRead = useMarkNotificationRead();
  const logout = useLogout();

  const unreadCount = notifications?.filter((n) => !n.isRead).length ?? 0;

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border bg-surface px-4 md:px-6">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{user?.phone}</p>
        {user ? <p className="seller-eyebrow">{ROLE_LABEL[user.role]}</p> : null}
      </div>

      <div className="flex items-center gap-2">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              aria-label="Bildirishnomalar"
              className="relative flex h-9 w-9 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 ? (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-foreground">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={8}
              className="z-100 max-h-96 w-80 overflow-y-auto rounded-md border border-border bg-surface p-1 shadow-2xl"
            >
              {!notifications || notifications.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-muted">Bildirishnoma yo&apos;q</p>
              ) : (
                notifications.map((notification) => (
                  <DropdownMenu.Item
                    key={notification.id}
                    onSelect={() => {
                      if (!notification.isRead) markRead.mutate({ id: notification.id });
                    }}
                    className={cn(
                      "flex cursor-pointer flex-col gap-0.5 rounded-md px-3 py-2 text-sm outline-none transition-colors hover:bg-surface-hover",
                      !notification.isRead && "bg-accent-subtle/40"
                    )}
                  >
                    <span className="flex items-center gap-2 font-medium text-foreground">
                      {!notification.isRead ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" /> : null}
                      {notification.title}
                    </span>
                    <span className="text-xs text-muted">{notification.body}</span>
                    <span className="text-[11px] text-disabled">{formatDateTime(notification.createdAt)}</span>
                  </DropdownMenu.Item>
                ))
              )}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        <button
          type="button"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          aria-label="Chiqish"
          className="flex h-9 w-9 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-hover hover:text-danger disabled:opacity-50"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
