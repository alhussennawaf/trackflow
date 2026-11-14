import type { DocStatus, Role, Task, Risk, Company, Project } from './types';

export type Tone = 'neutral' | 'info' | 'warn' | 'good' | 'bad' | 'brand';

export const STATUS: Record<DocStatus, { label: string; tone: Tone }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  submitted: { label: 'Submitted', tone: 'info' },
  under_review: { label: 'Under review', tone: 'warn' },
  approved: { label: 'Approved · A', tone: 'good' },
  approved_as_noted: { label: 'Approved as noted · B', tone: 'good' },
  revise_resubmit: { label: 'Revise & resubmit · C', tone: 'bad' },
  rejected: { label: 'Rejected · D', tone: 'bad' },
  replied: { label: 'Replied', tone: 'good' },
  responded: { label: 'Company responded', tone: 'info' },
  returned: { label: 'Returned', tone: 'bad' },
  on_hold: { label: 'On hold', tone: 'warn' },
  paid: { label: 'Paid', tone: 'good' },
  closed: { label: 'Closed', tone: 'neutral' },
  superseded: { label: 'Superseded', tone: 'neutral' },
};

// What the action button says for each target status.
export const ACTION_LABEL: Partial<Record<DocStatus, string>> = {
  under_review: 'Start review',
  approved: 'Approve (A)',
  approved_as_noted: 'Approve as noted (B)',
  revise_resubmit: 'Revise & resubmit (C)',
  rejected: 'Reject (D)',
  replied: 'Send reply',
  responded: 'Send response',
  returned: 'Return to company',
  on_hold: 'Put on hold',
  paid: 'Mark paid',
  closed: 'Close',
};

// Inspection results read better as passed / failed.
export const INSPECTION_LABEL: Partial<Record<DocStatus, string>> = {
  approved: 'Passed',
  approved_as_noted: 'Passed with comments',
  rejected: 'Failed',
};

export const OPEN_STATUSES: DocStatus[] = ['submitted', 'under_review', 'responded', 'returned', 'on_hold'];
export const DONE_STATUSES: DocStatus[] = ['approved', 'approved_as_noted', 'replied', 'paid', 'closed', 'rejected'];

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administrator',
  manager: 'Project manager',
  engineer: 'Engineer',
  employee: 'Employee',
  accountant: 'Accountant / finance',
  external: 'External user',
};

export const TASK_STATUS: Record<Task['status'], { label: string; tone: Tone }> = {
  todo: { label: 'To do', tone: 'neutral' },
  in_progress: { label: 'In progress', tone: 'info' },
  review: { label: 'Done, awaiting JAK', tone: 'warn' },
  blocked: { label: 'Blocked', tone: 'bad' },
  done: { label: 'Done', tone: 'good' },
};

export const PRIORITY: Record<Task['priority'], { label: string; tone: Tone }> = {
  low: { label: 'Low', tone: 'neutral' },
  medium: { label: 'Medium', tone: 'info' },
  high: { label: 'High', tone: 'warn' },
  urgent: { label: 'Urgent', tone: 'bad' },
};

export const RISK_STATUS: Record<Risk['status'], { label: string; tone: Tone }> = {
  open: { label: 'Open', tone: 'bad' },
  monitoring: { label: 'Monitoring', tone: 'warn' },
  closed: { label: 'Closed', tone: 'neutral' },
};

export const COMPANY_KIND: Record<Company['kind'], string> = {
  internal: 'JAK',
  subcontractor: 'Subcontractor',
  supplier: 'Supplier',
  consultant: 'Consultant',
  client: 'Client',
  main_contractor: 'Main contractor',
};

export const PROJECT_STATUS: Record<Project['status'], { label: string; tone: Tone }> = {
  planning: { label: 'Planning', tone: 'info' },
  active: { label: 'Active', tone: 'good' },
  on_hold: { label: 'On hold', tone: 'warn' },
  completed: { label: 'Completed', tone: 'neutral' },
};

export function riskTone(score: number): Tone {
  if (score >= 15) return 'bad';
  if (score >= 8) return 'warn';
  return 'good';
}

export const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d.length === 10 ? d + 'T00:00:00' : d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export const fmtDateTime = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

export const fmtMoney = (n: number | null | undefined) =>
  n == null ? '—' : 'SAR ' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtSize = (b: number) => (b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`);

export const isOverdue = (due: string | null, status: string) =>
  !!due && OPEN_STATUSES.includes(status as DocStatus) && new Date(due + 'T23:59:59') < new Date();
