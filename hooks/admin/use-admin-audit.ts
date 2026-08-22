"use client";

import { useQuery } from "@tanstack/react-query";
import { adminKeys } from "@/lib/api/admin/keys";
import { fetchAudit, type AuditListResult } from "@/lib/api/admin/resources";
import type { AuditListQuery } from "@/lib/schemas";
import { PANEL_STALE_MS } from "./use-panel-mutation";

/**
 * The audit trail, newest first.
 *
 * Read-only — the log is append-only by design and nothing in the panel can
 * edit it — so there is no mutation here. It still belongs on React Query: the
 * entries are written by everyone else's actions, and every panel write
 * invalidates this key, so a director with the trail open sees a colleague's
 * edit appear rather than a page they have to reload.
 */
export function useAdminAudit(query: AuditListQuery, initialData?: AuditListResult) {
  return useQuery({
    queryKey: adminKeys.audit.list(query),
    queryFn: () => fetchAudit(query),
    initialData,
    staleTime: PANEL_STALE_MS,
  });
}
