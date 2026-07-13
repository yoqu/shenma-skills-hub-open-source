import Table from 'cli-table3';

export function renderTable(head: string[], rows: Array<Array<string | number>>): string {
  const t = new Table({ head, style: { head: ['cyan'] } });
  for (const r of rows) t.push(r.map(c => String(c ?? '')));
  return t.toString();
}
