/** Matches the shape of the table it stands in for, so a loading list doesn't jump when data lands. */
export function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex}>
          {Array.from({ length: columns }).map((__, colIndex) => (
            <td key={colIndex} className="px-4 py-3">
              <div className="h-4 animate-pulse rounded-sm bg-surface-muted" style={{ width: `${60 + ((rowIndex + colIndex) % 3) * 15}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
