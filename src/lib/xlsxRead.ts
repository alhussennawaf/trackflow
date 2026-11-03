import { strFromU8, unzipSync } from 'fflate';

export type XCell = string | number | null;

// Reads the first worksheet of an .xlsx file into rows of cell values (text or number).
export function readXlsx(bytes: Uint8Array): XCell[][] {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new Error('This is not an Excel (.xlsx) file.');
  }
  const xml = (name: string) => (files[name] ? new DOMParser().parseFromString(strFromU8(files[name]), 'application/xml') : null);
  const shared = Array.from(xml('xl/sharedStrings.xml')?.getElementsByTagName('si') ?? []).map((si) =>
    Array.from(si.getElementsByTagName('t'))
      .map((t) => t.textContent ?? '')
      .join(''),
  );
  // First sheet listed in the workbook.
  const wb = xml('xl/workbook.xml');
  const rels = xml('xl/_rels/workbook.xml.rels');
  const firstId = wb?.getElementsByTagName('sheet')[0]?.getAttribute('r:id');
  const target = Array.from(rels?.getElementsByTagName('Relationship') ?? []).find((r) => r.getAttribute('Id') === firstId)?.getAttribute('Target');
  const path = target ? 'xl/' + target.replace(/^\/?xl\//, '').replace(/^\//, '') : 'xl/worksheets/sheet1.xml';
  const sheet = xml(path) ?? xml('xl/worksheets/sheet1.xml');
  if (!sheet) throw new Error('The Excel file has no worksheet.');

  const colIndex = (ref: string) => {
    const letters = /^[A-Z]+/.exec(ref)?.[0] ?? 'A';
    return letters.split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
  };
  const out: XCell[][] = [];
  for (const row of Array.from(sheet.getElementsByTagName('row'))) {
    const r = Number(row.getAttribute('r')) - 1;
    const cells: XCell[] = [];
    for (const c of Array.from(row.getElementsByTagName('c'))) {
      const t = c.getAttribute('t');
      const v = c.getElementsByTagName('v')[0]?.textContent ?? null;
      let val: XCell = null;
      if (t === 's') val = v === null ? null : shared[Number(v)] ?? '';
      else if (t === 'inlineStr') val = Array.from(c.getElementsByTagName('t')).map((x) => x.textContent ?? '').join('');
      else if (t === 'str' || t === 'b' || t === 'e') val = v;
      else val = v === null ? null : Number(v);
      cells[colIndex(c.getAttribute('r') ?? 'A')] = val;
    }
    out[r] = Array.from(cells, (x) => (x === undefined ? null : x));
  }
  return Array.from(out, (x) => x ?? []);
}

// Excel stores dates as days since 1899-12-30.
export const excelDate = (v: XCell) => {
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000);
    return d.toISOString().slice(0, 10);
  }
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  return '';
};
