import * as React from 'react';

/** The chart's numbers as a table, folded under a "see as table" toggle. */
export function ChartTable({
  summary,
  columns,
  rows,
}: {
  summary: string;
  columns: string[];
  rows: { key: string; cells: string[] }[];
}) {
  return (
    <details className="mt-3 text-xs">
      <summary className="cursor-pointer font-medium text-on-surface-variant hover:text-on-background">
        {summary}
      </summary>
      <div className="mt-2 max-h-64 overflow-auto">
        <table className="w-full text-left tabular-nums">
          <thead>
            <tr className="text-on-surface-variant">
              {columns.map((column) => (
                <th key={column} scope="col" className="py-1 pr-3 font-medium">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-outline">
                {row.cells.map((cell, i) => (
                  <td key={columns[i]} className="py-1 pr-3 text-on-background">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
