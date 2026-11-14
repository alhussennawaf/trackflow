// Row shapes of the backend tables (supabase/migrations).

export type Kind = 'internal' | 'external';
export type Role = 'admin' | 'manager' | 'engineer' | 'employee' | 'accountant' | 'external';

export type Profile = {
  id: string;
  kind: Kind;
  company_id: string;
  role: Role;
  full_name: string;
  email: string;
  title: string;
  phone: string;
  active: boolean;
  access_ends_on: string | null;
  created_at: string;
};

export type Company = {
  id: string;
  code: string;
  name: string;
  kind: 'internal' | 'subcontractor' | 'supplier' | 'consultant' | 'client' | 'main_contractor';
  trade_codes: string[];
  contact_person: string;
  phone: string;
  email: string;
  cr_number: string;
  vat_number: string;
  active: boolean;
  created_at: string;
};

export type Project = {
  id: string;
  code: string;
  name: string;
  client: string;
  consultant: string;
  location: string;
  status: 'planning' | 'active' | 'on_hold' | 'completed';
  start_date: string | null;
  end_date: string | null;
  created_at: string;
};

export type Member = { project_id: string; profile_id: string };

export type Invitation = {
  id: string;
  email: string;
  company_id: string;
  full_name: string;
  project_ids: string[];
  access_ends_on: string;
  created_at: string;
  accepted_at: string | null;
  revoked: boolean;
};

export type Trade = { code: string; name: string; sort: number; active: boolean };
export type SubTrade = { trade_code: string; code: string; name: string; sort: number; active: boolean };
export type Level = { id: string; project_id: string | null; code: string; name: string; sort: number; active: boolean };

export type ReviewKind = 'submittal' | 'inspection' | 'reply' | 'report' | 'instruction' | 'ncr' | 'invoice';
export type DocType = {
  code: string;
  name: string;
  family: string;
  page: 'requests' | 'reports';
  raised_by: 'company' | 'jak';
  review_kind: ReviewKind;
  sort: number;
  active: boolean;
};

export type Transition = { review_kind: ReviewKind; from_status: string; to_status: string; actor: 'reviewer' | 'finance' | 'company' };
export type Revisable = { review_kind: ReviewKind; status: string };

export type DocStatus =
  | 'draft' | 'submitted' | 'under_review' | 'approved' | 'approved_as_noted' | 'revise_resubmit' | 'rejected'
  | 'replied' | 'responded' | 'returned' | 'on_hold' | 'paid' | 'closed' | 'superseded';

export type Doc = {
  id: string;
  project_id: string;
  doc_type: string;
  company_id: string;
  trade_code: string | null;
  sub_trade_code: string | null;
  level_code: string | null;
  seq: number | null;
  revision: number;
  ref: string | null;
  root_id: string | null;
  title: string;
  description: string;
  fields: Record<string, string>;
  status: DocStatus;
  due_date: string | null;
  reviewer_id: string | null;
  review_code: 'A' | 'B' | 'C' | 'D' | null;
  official_reply: string;
  replied_by: string | null;
  replied_at: string | null;
  amount: number | null;
  payment_ref: string;
  paid_on: string | null;
  submitted_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type Comment = { id: string; document_id: string; author_id: string; body: string; internal: boolean; created_at: string };

export type FileRow = {
  id: string;
  storage_path: string;
  name: string;
  mime: string;
  size: number;
  document_id: string | null;
  project_id: string | null;
  company_id: string | null;
  visibility: 'internal' | 'all_companies' | 'company';
  shared_company_id: string | null;
  folder: string;
  uploaded_by: string;
  created_at: string;
};

export type Task = {
  id: string;
  project_id: string;
  title: string;
  description: string;
  assignee_id: string | null;
  assignee_company_id: string | null;
  document_id: string | null;
  risk_id: string | null;
  status: 'todo' | 'in_progress' | 'review' | 'blocked' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date: string | null;
  created_by: string;
  created_at: string;
};

export type Risk = {
  id: string;
  project_id: string;
  title: string;
  description: string;
  likelihood: number;
  impact: number;
  score: number;
  owner_id: string | null;
  mitigation: string;
  status: 'open' | 'monitoring' | 'closed';
  target_date: string | null;
  created_by: string;
  created_at: string;
};

export type Notice = { id: string; user_id: string; title: string; body: string; link: string; read: boolean; created_at: string };
