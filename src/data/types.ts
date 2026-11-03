// Row shapes mirror the Supabase tables in supabase/schema.sql (snake_case on purpose).

export type Role = 'admin' | 'manager' | 'engineer' | 'employee' | 'accountant';

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  title: string;
  phone: string;
  employee_no: string;
  department?: string;
  nationality?: string;
  work_location?: string;
  joining_date?: string; // YYYY-MM-DD
  active: boolean;
  created_at: string;
  // Pay details: stored apart (salaries table) so only HR, managers and the employee can read them.
  monthly_salary: number; // basic salary
  housing_allowance?: number;
  transport_allowance?: number;
  phone_allowance?: number;
  other_allowance?: number;
  national_id?: string;
  bank_name?: string;
  iban?: string;
};

export const PAY_FIELDS = ['monthly_salary', 'housing_allowance', 'transport_allowance', 'phone_allowance', 'other_allowance', 'national_id', 'bank_name', 'iban'] as const;

export const allowancesOf = (p: Profile) => (p.housing_allowance ?? 0) + (p.transport_allowance ?? 0) + (p.phone_allowance ?? 0) + (p.other_allowance ?? 0);

export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed';

export type Project = {
  id: string;
  code: string;
  name: string;
  client: string;
  consultant: string;
  location: string;
  status: ProjectStatus;
  start_date: string;
  end_date: string;
  progress: number;
  value: number;
  description: string;
  member_ids: string[];
  created_at: string;
};

export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done' | 'blocked';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export type Task = {
  id: string;
  project_id: string;
  title: string;
  description: string;
  assignee_id: string;
  created_by: string;
  status: TaskStatus;
  priority: Priority;
  due_date: string;
  location: string;
  created_at: string;
};

export type SubmittalStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'approved_as_noted'
  | 'revise_resubmit'
  | 'rejected'
  | 'replied'
  | 'closed';

export type Attachment = { name: string; url: string; mime?: string; size?: number };

export type Submittal = {
  id: string;
  project_id: string;
  contractor_id: string;
  type: string; // see SUBMITTAL_TYPES
  number: string;
  revision: number;
  title: string;
  discipline: string;
  description: string;
  fields: Record<string, string>; // type-specific fields
  status: SubmittalStatus;
  submitted_date: string;
  due_date: string;
  assigned_to: string;
  created_by: string;
  reply: string;
  attachments: Attachment[];
  building?: string; // building / area, e.g. "Khalid Villa"
  responded_date?: string;
  created_at: string;
};

export type Contractor = {
  id: string;
  name: string;
  trade: string;
  kind: 'subcontractor' | 'supplier' | 'consultant' | 'client' | 'main_contractor';
  contact_person: string;
  phone: string;
  email: string;
  cr_number: string;
  vat_number: string;
  project_ids: string[];
  code?: string; // short code used in their document numbers, e.g. ARC
  created_at: string;
};

export type ContractorFolder =
  | 'documents'
  | 'contracts'
  | 'submittals'
  | 'rfis'
  | 'mirs'
  | 'invoices'
  | 'others';

export type DocumentFile = {
  id: string;
  contractor_id: string;
  project_id: string;
  folder: ContractorFolder;
  name: string;
  url: string;
  mime: string;
  size: number;
  // invoice-only
  amount: number;
  invoice_status: 'pending' | 'approved' | 'paid' | '';
  notes: string;
  uploaded_by: string;
  created_at: string;
};

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'leave' | 'sick' | 'holiday';

export type Attendance = {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  check_in: string; // ISO
  check_out: string; // ISO
  status: AttendanceStatus;
  project_id: string;
  latitude: number | null;
  longitude: number | null;
  notes: string;
  created_at: string;
};

export type Photo = {
  id: string;
  project_id: string;
  url: string;
  caption: string;
  scope: string;
  section: string;
  category: string;
  taken_at: string;
  uploaded_by: string;
  created_at: string;
};

export type Notice = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  link: string; // route name + id, e.g. "task:<id>"
  read: boolean;
  created_at: string;
};

export type DailyReport = {
  id: string;
  project_id: string;
  date: string;
  weather: string;
  manpower: number;
  equipment: string;
  work_done: string;
  issues: string;
  created_by: string;
  created_at: string;
};

export type Settings = {
  id: string; // always 'company'
  work_start: string; // "07:00"
  grace_minutes: number;
  work_hours: number;
  weekend_days: number[]; // 0=Sun ... 5=Fri, 6=Sat
  late_deduction_ratio: number; // fraction of a day's pay per late arrival
  overtime_rate: number; // multiplier of hourly pay
  currency: string;
  company_name: string;
  company_name_ar: string;
  doc_prefix: string; // first part of document numbers, e.g. JAK
  employee_prefix: string; // e.g. JAK-EMP
};

export type Tables = {
  profiles: Profile;
  projects: Project;
  tasks: Task;
  submittals: Submittal;
  contractors: Contractor;
  documents: DocumentFile;
  attendance: Attendance;
  photos: Photo;
  notices: Notice;
  daily_reports: DailyReport;
  settings: Settings;
};

export type TableName = keyof Tables;
