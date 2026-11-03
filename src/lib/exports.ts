import { ATTENDANCE_STATUS, CONTRACTOR_FOLDERS, docRef, PRIORITY, SUBMITTAL_STATUS, submittalType, TASK_STATUS } from '../data/catalog';
import type { Attendance, Contractor, DocumentFile, Profile, Project, Submittal, Task } from '../data/types';
import type { PayrollRow } from '../pdf/templates';
import { daysInMonth, fmtTime, MONTH_NAMES, pad } from './dates';
import { saveFile } from './download';
import { hoursWorked } from './payroll';
import { buildXlsx, Sheet, XLSX_MIME } from './xlsx';

type Lookup = { projects: Project[]; profiles: Profile[]; contractors: Contractor[] };
const projectName = (l: Lookup, id: string) => l.projects.find((p) => p.id === id)?.name ?? '';
const personName = (l: Lookup, id: string) => l.profiles.find((p) => p.id === id)?.full_name ?? '';
const contractorName = (l: Lookup, id: string) => l.contractors.find((c) => c.id === id)?.name ?? '';
const stamp = () => new Date().toISOString().slice(0, 10);

export const saveXlsx = (name: string, sheets: Sheet[]) => saveFile(name, buildXlsx(sheets), XLSX_MIME);

export function payrollSheet(rows: PayrollRow[], label: string, currency: string): Sheet {
  const sum = (f: (r: PayrollRow) => number) => rows.reduce((a, r) => a + f(r), 0);
  return {
    name: label,
    title: `Salary sheet: ${label}`,
    columns: [
      { header: 'Emp. no.' },
      { header: 'Name' },
      { header: 'Title' },
      { header: 'Working days' },
      { header: 'Present' },
      { header: 'Late' },
      { header: 'Absent' },
      { header: 'Leave' },
      { header: 'OT hours' },
      { header: `Basic (${currency})`, money: true },
      { header: `Allowances (${currency})`, money: true },
      { header: `Deductions (${currency})`, money: true },
      { header: `Overtime (${currency})`, money: true },
      { header: `Net pay (${currency})`, money: true },
    ],
    rows: rows.map((r) => [r.user.employee_no, r.user.full_name, r.user.title, r.workingDays, r.present, r.late, r.absent, r.leave, r.overtimeHours, r.basic, r.allowances, r.deductions, r.overtimePay, r.net]),
    totals: ['Total', `${rows.length} employees`, '', '', '', '', '', '', sum((r) => r.overtimeHours), sum((r) => r.basic), sum((r) => r.allowances), sum((r) => r.deductions), sum((r) => r.overtimePay), sum((r) => r.net)],
  };
}

export function submittalSheet(list: Submittal[], l: Lookup): Sheet {
  return {
    name: 'Submittal register',
    title: 'Submittal register',
    columns: [
      { header: 'Document no.' },
      { header: 'Rev', width: 6 },
      { header: 'Type' },
      { header: 'Title', width: 40 },
      { header: 'Project' },
      { header: 'Contractor' },
      { header: 'Discipline' },
      { header: 'Status' },
      { header: 'Submitted' },
      { header: 'Reply due' },
      { header: 'Reviewer' },
      { header: 'Reply / comments', width: 40 },
    ],
    rows: [...list]
      .sort((a, b) => a.number.localeCompare(b.number) || a.revision - b.revision)
      .map((s) => [docRef(s), s.revision, submittalType(s.type).name, s.title, projectName(l, s.project_id), contractorName(l, s.contractor_id), s.discipline, SUBMITTAL_STATUS[s.status].label, s.submitted_date, s.due_date, personName(l, s.assigned_to), s.reply]),
  };
}

export function taskSheet(list: Task[], l: Lookup): Sheet {
  return {
    name: 'Tasks',
    title: 'Task list',
    columns: [{ header: 'Task', width: 40 }, { header: 'Project' }, { header: 'Assigned to' }, { header: 'Priority' }, { header: 'Status' }, { header: 'Due date' }, { header: 'Location' }, { header: 'Description', width: 40 }],
    rows: [...list]
      .sort((a, b) => a.due_date.localeCompare(b.due_date))
      .map((t) => [t.title, projectName(l, t.project_id), personName(l, t.assignee_id), PRIORITY[t.priority].label, TASK_STATUS[t.status].label, t.due_date, t.location, t.description]),
  };
}

// One row per employee, one column per day of the month (P, L, A, AL…), plus totals.
export function attendanceSheets(records: Attendance[], people: Profile[], y: number, m: number, l: Lookup): Sheet[] {
  const days = daysInMonth(y, m);
  const prefix = `${y}-${pad(m + 1)}`;
  const month = records.filter((a) => a.date.startsWith(prefix));
  const label = `${MONTH_NAMES[m]} ${y}`;
  const grid: Sheet = {
    name: 'Monthly grid',
    title: `Attendance: ${label}`,
    columns: [{ header: 'Emp. no.' }, { header: 'Name' }, ...Array.from({ length: days }, (_, i) => ({ header: String(i + 1), width: 4.5 })), { header: 'Present' }, { header: 'Late' }, { header: 'Absent' }, { header: 'Leave' }],
    rows: people.map((p) => {
      const mine = month.filter((a) => a.user_id === p.id);
      const cells = Array.from({ length: days }, (_, i) => {
        const r = mine.find((a) => a.date === `${prefix}-${pad(i + 1)}`);
        return r ? ATTENDANCE_STATUS[r.status].short : '';
      });
      const n = (s: string[]) => mine.filter((a) => s.includes(a.status)).length;
      return [p.employee_no, p.full_name, ...cells, n(['present']), n(['late']), n(['absent']), n(['leave', 'sick'])];
    }),
  };
  const log: Sheet = {
    name: 'Check-in log',
    title: `Check-in log: ${label}`,
    columns: [{ header: 'Date' }, { header: 'Emp. no.' }, { header: 'Name' }, { header: 'Status' }, { header: 'Check in' }, { header: 'Check out' }, { header: 'Hours' }, { header: 'Project / site' }, { header: 'Location' }, { header: 'Notes', width: 30 }],
    rows: [...month]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((a) => {
        const p = people.find((x) => x.id === a.user_id);
        return [a.date, p?.employee_no, p?.full_name ?? personName(l, a.user_id), ATTENDANCE_STATUS[a.status].label, a.check_in ? fmtTime(a.check_in) : '', a.check_out ? fmtTime(a.check_out) : '', Math.round(hoursWorked(a) * 10) / 10 || '', projectName(l, a.project_id), a.latitude != null ? `${a.latitude.toFixed(5)}, ${a.longitude?.toFixed(5)}` : '', a.notes];
      }),
  };
  return [grid, log];
}

export function contractorSheets(contractors: Contractor[], docs: DocumentFile[], l: Lookup): Sheet[] {
  return [
    {
      name: 'Contractors',
      title: 'Contractors and suppliers',
      columns: [{ header: 'Name', width: 32 }, { header: 'Type' }, { header: 'Trade' }, { header: 'Contact person' }, { header: 'Phone' }, { header: 'Email' }, { header: 'CR number' }, { header: 'VAT number' }, { header: 'Projects', width: 40 }],
      rows: contractors.map((c) => [c.name, c.kind.replace('_', ' '), c.trade, c.contact_person, c.phone, c.email, c.cr_number, c.vat_number, c.project_ids.map((id) => projectName(l, id)).join(', ')]),
    },
    {
      name: 'Documents',
      title: 'Contractor documents and invoices',
      columns: [{ header: 'Contractor', width: 30 }, { header: 'Folder' }, { header: 'Document', width: 36 }, { header: 'Project' }, { header: 'Amount', money: true }, { header: 'Invoice status' }, { header: 'Uploaded' }, { header: 'Notes', width: 30 }],
      rows: docs.map((d) => [contractorName(l, d.contractor_id), CONTRACTOR_FOLDERS.find((f) => f.key === d.folder)?.label ?? d.folder, d.name, projectName(l, d.project_id), d.amount || '', d.invoice_status, d.created_at.slice(0, 10), d.notes]),
    },
  ];
}

export const fileStamp = stamp;
