export function dateRangeQuery(range?: { from?: Date; to?: Date }) {
  const from = range?.from && new Date(range.from);
  const to = range?.to && new Date(range.to);
  from?.setHours(0, 0, 0, 0);
  to?.setHours(23, 59, 59, 999);
  return { dateFrom: from?.toISOString(), dateTo: to?.toISOString() };
}
