import type { Profile, Role } from '../data/types';
import { excelDate, readXlsx, XCell } from './xlsxRead';

// Reads an employee / payroll directory spreadsheet (e.g. "JADAH - Employees - Payroll Directory.xlsx").
// Columns are found by their header text, so the order of columns does not matter.

export type ImportedEmployee = Omit<Profile, 'id' | 'created_at' | 'active'>;

const COLUMNS: [keyof ImportedEmployee, RegExp][] = [
  ['full_name', /employee name|^name/i],
  ['employee_no', /employee no|emp\.? ?no/i],
  ['title', /^position|job title|designation/i],
  ['national_id', /id no|iqama|national id/i],
  ['department', /department/i],
  ['work_location', /^location/i],
  ['nationality', /nationality/i],
  ['phone', /contact|mobile|phone no/i],
  ['email', /e-?mail/i],
  ['monthly_salary', /basic salary/i],
  ['housing_allowance', /housing/i],
  ['transport_allowance', /transport/i],
  ['phone_allowance', /phone allowance/i],
  ['other_allowance', /other allowance/i],
  ['joining_date', /joining/i],
  ['bank_name', /^bank \/|^bank$|bank name/i],
  ['iban', /account no|iban/i],
];

const SMALL = new Set(['of', 'and', '&', '-', 'for']);
const KEEP_UPPER = /^(CEO|CFO|COO|MEP|QHSE|HSE|QA|QC|QA\/QC|IT|HR|PM|ZAC|ID)$/;
export const titleCase = (s: string) =>
  s
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((w, i) => (KEEP_UPPER.test(w) ? w : i > 0 && SMALL.has(w.toLowerCase()) ? w.toLowerCase() : w.toLowerCase().replace(/(^|[-(/])([a-z])/g, (_, p, ch) => p + ch.toUpperCase())))
    .join(' ')
    .replace(/\bDeptt\.?/gi, 'Dept.')
    .replace(/\bArchiticture\b/gi, 'Architecture')
    .replace(/\bEgyption\b/gi, 'Egyptian');

export function roleForTitle(title: string): Role {
  const t = title.toLowerCase();
  if (/\b(ceo|chairman|general manager|owner)\b/.test(t)) return 'admin';
  if (/account|finance|\bhr\b|human resource|payroll/.test(t)) return 'accountant';
  if (/manager|director|lead|head/.test(t)) return 'manager';
  if (/engineer|architect|surveyor|planner/.test(t)) return 'engineer';
  return 'employee';
}

const text = (v: XCell) => (v === null || v === undefined ? '' : String(v).trim());
const blank = (s: string) => !s || /^[-–—\s]*$/.test(s);
const num = (v: XCell) => (typeof v === 'number' ? v : parseFloat(text(v).replace(/,/g, '')) || 0);
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

export function parseEmployees(bytes: Uint8Array): ImportedEmployee[] {
  const rows = readXlsx(bytes);
  const headerIdx = rows.findIndex((r) => r.some((c) => /employee name|employee no/i.test(text(c))));
  if (headerIdx < 0) throw new Error('Could not find the header row (it needs "Employee Name" and "Employee No." columns).');
  const header = rows[headerIdx].map(text);
  const col: Partial<Record<keyof ImportedEmployee, number>> = {};
  for (const [key, re] of COLUMNS) {
    const i = header.findIndex((h, j) => re.test(h) && !Object.values(col).includes(j));
    if (i >= 0) col[key] = i;
  }
  if (col.full_name === undefined) throw new Error('No "Employee Name" column found.');
  const get = (r: XCell[], k: keyof ImportedEmployee) => (col[k] === undefined ? null : r[col[k]!] ?? null);

  const out: ImportedEmployee[] = [];
  for (const r of rows.slice(headerIdx + 1)) {
    const name = text(get(r, 'full_name'));
    if (blank(name) || /^(updated|prepared by|total)/i.test(name)) continue;
    const title = titleCase(text(get(r, 'title')));
    const email = text(get(r, 'email')).toLowerCase();
    const phone = text(get(r, 'phone'));
    const s = (k: keyof ImportedEmployee) => {
      const v = text(get(r, k));
      return blank(v) ? '' : v;
    };
    out.push({
      full_name: titleCase(name),
      employee_no: s('employee_no').toUpperCase(),
      title,
      role: roleForTitle(title),
      email: isEmail(email) ? email : '',
      phone: blank(phone) ? '' : /^5\d{8}$/.test(phone) ? `+966 ${phone}` : phone,
      department: titleCase(s('department')),
      work_location: titleCase(s('work_location')),
      nationality: titleCase(s('nationality')),
      national_id: s('national_id'),
      joining_date: excelDate(get(r, 'joining_date')),
      monthly_salary: num(get(r, 'monthly_salary')),
      housing_allowance: num(get(r, 'housing_allowance')),
      transport_allowance: num(get(r, 'transport_allowance')),
      phone_allowance: num(get(r, 'phone_allowance')),
      other_allowance: num(get(r, 'other_allowance')),
      bank_name: titleCase(s('bank_name')),
      iban: s('iban').replace(/\s+/g, '').toUpperCase(),
    });
  }
  return out;
}
