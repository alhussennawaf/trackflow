import type {
  AttendanceStatus,
  ContractorFolder,
  Priority,
  ProjectStatus,
  Role,
  SubmittalStatus,
  TaskStatus,
} from './types';

export type FieldDef = {
  key: string;
  label: string;
  multiline?: boolean;
  placeholder?: string;
};

export type SubmittalType = {
  code: string;
  name: string;
  icon: string; // Ionicons name
  folder: ContractorFolder; // contractor folder it files into
  fields: FieldDef[];
};

// Document types used on Saudi / GCC building projects. Each type has its own
// extra fields, which appear on the form and on the generated PDF.
export const SUBMITTAL_TYPES: SubmittalType[] = [
  {
    code: 'SD',
    name: 'Shop Drawing',
    icon: 'map-outline',
    folder: 'submittals',
    fields: [
      { key: 'drawing_numbers', label: 'Drawing numbers', placeholder: 'e.g. SD-ARC-101 to 112' },
      { key: 'sheets', label: 'No. of sheets' },
      { key: 'reference_spec', label: 'Specification section' },
      { key: 'reference_dwg', label: 'Reference contract drawings' },
    ],
  },
  {
    code: 'MAS',
    name: 'Material Approval Submittal',
    icon: 'cube-outline',
    folder: 'submittals',
    fields: [
      { key: 'material', label: 'Material / product' },
      { key: 'manufacturer', label: 'Manufacturer' },
      { key: 'supplier', label: 'Supplier' },
      { key: 'country_of_origin', label: 'Country of origin' },
      { key: 'reference_spec', label: 'Specification section' },
    ],
  },
  {
    code: 'MIR',
    name: 'Material Inspection Request',
    icon: 'search-outline',
    folder: 'mirs',
    fields: [
      { key: 'material', label: 'Material description' },
      { key: 'supplier', label: 'Supplier' },
      { key: 'quantity', label: 'Quantity delivered' },
      { key: 'delivery_note', label: 'Delivery note no.' },
      { key: 'mas_ref', label: 'Approved MAS reference' },
      { key: 'storage_location', label: 'Storage location on site' },
      { key: 'inspection_date', label: 'Inspection date & time' },
    ],
  },
  {
    code: 'WIR',
    name: 'Work Inspection Request',
    icon: 'construct-outline',
    folder: 'submittals',
    fields: [
      { key: 'activity', label: 'Activity / work item' },
      { key: 'location', label: 'Location / grid / level' },
      { key: 'drawing_ref', label: 'Approved drawing reference' },
      { key: 'inspection_date', label: 'Inspection date & time' },
    ],
  },
  {
    code: 'RFI',
    name: 'Request for Information',
    icon: 'help-circle-outline',
    folder: 'rfis',
    fields: [
      { key: 'question', label: 'Question / clarification required', multiline: true },
      { key: 'proposed_solution', label: "Contractor's proposed solution", multiline: true },
      { key: 'drawing_ref', label: 'Drawing / spec reference' },
      { key: 'cost_impact', label: 'Cost impact (Yes / No / TBD)' },
      { key: 'time_impact', label: 'Time impact (Yes / No / TBD)' },
    ],
  },
  {
    code: 'MS',
    name: 'Method Statement',
    icon: 'list-outline',
    folder: 'submittals',
    fields: [
      { key: 'activity', label: 'Activity covered' },
      { key: 'risk_assessment', label: 'Risk assessment reference' },
      { key: 'equipment', label: 'Plant & equipment', multiline: true },
    ],
  },
  {
    code: 'ITP',
    name: 'Inspection & Test Plan',
    icon: 'checkmark-done-outline',
    folder: 'submittals',
    fields: [
      { key: 'activity', label: 'Activity covered' },
      { key: 'hold_points', label: 'Hold / witness points', multiline: true },
    ],
  },
  {
    code: 'PQ',
    name: 'Prequalification',
    icon: 'ribbon-outline',
    folder: 'submittals',
    fields: [
      { key: 'company', label: 'Company prequalified' },
      { key: 'scope', label: 'Scope of work' },
      { key: 'classification', label: 'Classification / grade' },
    ],
  },
  {
    code: 'SAM',
    name: 'Sample Submittal',
    icon: 'color-palette-outline',
    folder: 'submittals',
    fields: [
      { key: 'sample', label: 'Sample description' },
      { key: 'quantity', label: 'Quantity' },
      { key: 'location', label: 'Sample kept at' },
    ],
  },
  {
    code: 'ABD',
    name: 'As-Built Drawing',
    icon: 'layers-outline',
    folder: 'submittals',
    fields: [
      { key: 'drawing_numbers', label: 'Drawing numbers' },
      { key: 'sheets', label: 'No. of sheets' },
    ],
  },
  {
    code: 'NCR',
    name: 'Non-Conformance Report',
    icon: 'alert-circle-outline',
    folder: 'submittals',
    fields: [
      { key: 'location', label: 'Location' },
      { key: 'non_conformance', label: 'Description of non-conformance', multiline: true },
      { key: 'root_cause', label: 'Root cause', multiline: true },
      { key: 'corrective_action', label: 'Corrective action', multiline: true },
      { key: 'close_by', label: 'Close-out date' },
    ],
  },
  {
    code: 'SI',
    name: 'Site Instruction',
    icon: 'megaphone-outline',
    folder: 'submittals',
    fields: [
      { key: 'instruction', label: 'Instruction', multiline: true },
      { key: 'issued_by', label: 'Issued by' },
    ],
  },
  {
    code: 'CVI',
    name: 'Confirmation of Verbal Instruction',
    icon: 'chatbubbles-outline',
    folder: 'submittals',
    fields: [
      { key: 'instruction', label: 'Verbal instruction received', multiline: true },
      { key: 'given_by', label: 'Given by' },
      { key: 'given_on', label: 'Given on (date)' },
    ],
  },
  {
    code: 'VOR',
    name: 'Variation Order Request',
    icon: 'swap-horizontal-outline',
    folder: 'contracts',
    fields: [
      { key: 'reason', label: 'Reason for variation', multiline: true },
      { key: 'cost_impact', label: 'Estimated cost impact' },
      { key: 'time_impact', label: 'Estimated time impact (days)' },
    ],
  },
  {
    code: 'TR',
    name: 'Document Transmittal',
    icon: 'paper-plane-outline',
    folder: 'documents',
    fields: [
      { key: 'to', label: 'To' },
      { key: 'documents', label: 'Documents transmitted', multiline: true },
      { key: 'purpose', label: 'Purpose (approval / information / record)' },
    ],
  },
  {
    code: 'PAY',
    name: 'Payment Application',
    icon: 'cash-outline',
    folder: 'invoices',
    fields: [
      { key: 'period', label: 'Period covered' },
      { key: 'gross_amount', label: 'Gross amount' },
      { key: 'retention', label: 'Retention' },
      { key: 'net_amount', label: 'Net amount due' },
    ],
  },
  {
    code: 'DSF',
    name: 'Document Submittal Form',
    icon: 'documents-outline',
    folder: 'submittals',
    fields: [
      { key: 'documents', label: 'Documents submitted', multiline: true },
      { key: 'reference_dwg', label: 'Reference drawings / specs' },
    ],
  },
  {
    code: 'RFINS',
    name: 'Request for Inspection',
    icon: 'eye-outline',
    folder: 'rfis',
    fields: [
      { key: 'activity', label: 'Work / activity to inspect' },
      { key: 'location', label: 'Location' },
      { key: 'inspection_date', label: 'Inspection date & time' },
    ],
  },
  {
    code: 'SWR',
    name: 'Start Work Request',
    icon: 'play-circle-outline',
    folder: 'submittals',
    fields: [
      { key: 'activity', label: 'Activity' },
      { key: 'location', label: 'Location' },
      { key: 'start_date', label: 'Planned start date' },
    ],
  },
  {
    code: 'RCI',
    name: 'Request for Concrete Inspection',
    icon: 'construct-outline',
    folder: 'rfis',
    fields: [
      { key: 'element', label: 'Element (slab, column, footing…)' },
      { key: 'location', label: 'Location' },
      { key: 'volume', label: 'Concrete volume (m³)' },
      { key: 'pour_date', label: 'Pour date & time' },
    ],
  },
  {
    code: 'SAR',
    name: 'Supplier Approval Request',
    icon: 'storefront-outline',
    folder: 'submittals',
    fields: [
      { key: 'supplier', label: 'Supplier / company' },
      { key: 'scope', label: 'Scope of supply' },
    ],
  },
  {
    code: 'MER',
    name: 'Material Exit Request',
    icon: 'exit-outline',
    folder: 'mirs',
    fields: [
      { key: 'material', label: 'Material' },
      { key: 'quantity', label: 'Quantity' },
      { key: 'reason', label: 'Reason' },
    ],
  },
  {
    code: 'RFP',
    name: 'Request for Proposal',
    icon: 'pricetags-outline',
    folder: 'others',
    fields: [
      { key: 'scope', label: 'Scope', multiline: true },
      { key: 'deadline', label: 'Proposal deadline' },
    ],
  },
  {
    code: 'INV',
    name: 'Invoice',
    icon: 'receipt-outline',
    folder: 'invoices',
    fields: [
      { key: 'invoice_no', label: 'Invoice number' },
      { key: 'amount', label: 'Amount' },
    ],
  },
];

export const submittalType = (code: string) =>
  SUBMITTAL_TYPES.find((t) => t.code === code) ?? SUBMITTAL_TYPES[0];

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'primary';

export const SUBMITTAL_STATUS: Record<SubmittalStatus, { label: string; tone: Tone; code?: string }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  submitted: { label: 'Submitted', tone: 'info' },
  under_review: { label: 'Under review', tone: 'warning' },
  approved: { label: 'Approved', tone: 'success', code: 'A' },
  approved_as_noted: { label: 'Approved as noted', tone: 'success', code: 'B' },
  revise_resubmit: { label: 'Revise & resubmit', tone: 'danger', code: 'C' },
  rejected: { label: 'Rejected', tone: 'danger', code: 'D' },
  replied: { label: 'Replied', tone: 'success' },
  closed: { label: 'Closed', tone: 'neutral' },
};

export const TASK_STATUS: Record<TaskStatus, { label: string; tone: Tone }> = {
  todo: { label: 'To do', tone: 'neutral' },
  in_progress: { label: 'In progress', tone: 'info' },
  review: { label: 'In review', tone: 'warning' },
  blocked: { label: 'Blocked', tone: 'danger' },
  done: { label: 'Done', tone: 'success' },
};

export const PRIORITY: Record<Priority, { label: string; tone: Tone }> = {
  low: { label: 'Low', tone: 'neutral' },
  medium: { label: 'Medium', tone: 'info' },
  high: { label: 'High', tone: 'warning' },
  urgent: { label: 'Urgent', tone: 'danger' },
};

export const PROJECT_STATUS: Record<ProjectStatus, { label: string; tone: Tone }> = {
  planning: { label: 'Planning', tone: 'info' },
  active: { label: 'Active', tone: 'success' },
  on_hold: { label: 'On hold', tone: 'warning' },
  completed: { label: 'Completed', tone: 'neutral' },
};

export const ATTENDANCE_STATUS: Record<AttendanceStatus, { label: string; tone: Tone; short: string }> = {
  present: { label: 'Present', tone: 'success', short: 'P' },
  late: { label: 'Late', tone: 'warning', short: 'L' },
  absent: { label: 'Absent', tone: 'danger', short: 'A' },
  leave: { label: 'Annual leave', tone: 'info', short: 'AL' },
  sick: { label: 'Sick leave', tone: 'info', short: 'S' },
  holiday: { label: 'Holiday', tone: 'neutral', short: 'H' },
};

export const ROLES: Record<Role, string> = {
  admin: 'Administrator',
  manager: 'Project Manager',
  engineer: 'Engineer',
  employee: 'Employee',
  accountant: 'Accountant / HR',
};

export const CONTRACTOR_FOLDERS: { key: ContractorFolder; label: string; icon: string }[] = [
  { key: 'documents', label: 'Contractor Documents', icon: 'document-text-outline' },
  { key: 'contracts', label: 'Contracts', icon: 'briefcase-outline' },
  { key: 'submittals', label: 'Submittals', icon: 'albums-outline' },
  { key: 'rfis', label: 'RFIs', icon: 'help-circle-outline' },
  { key: 'mirs', label: 'MIRs', icon: 'search-outline' },
  { key: 'invoices', label: 'Invoices', icon: 'receipt-outline' },
  { key: 'others', label: 'Others', icon: 'folder-open-outline' },
];

export const CONTRACTOR_KINDS = {
  subcontractor: 'Subcontractor',
  supplier: 'Supplier',
  consultant: 'Consultant',
  client: 'Client',
  main_contractor: 'Main contractor',
} as const;

export const DISCIPLINES = ['Civil', 'Structural', 'Architectural', 'Mechanical', 'Electrical', 'Plumbing', 'Fire Fighting', 'HVAC', 'Landscape', 'General'];

// Photo gallery taxonomy. Projects can add their own values when uploading.
export const PHOTO_SCOPES = ['Excavation & Earthworks', 'Foundations', 'Concrete Structure', 'Blockwork', 'Plaster & Finishes', 'MEP', 'Facade', 'External Works'];
export const PHOTO_SECTIONS = ['Basement', 'Ground Floor', 'First Floor', 'Second Floor', 'Roof', 'External Area', 'Site Office'];
export const PHOTO_CATEGORIES = ['Progress', 'Quality / Snags', 'Safety', 'Before / After', 'Deliveries', 'Inspections'];

// Full document reference with revision, e.g. JAK-MLZ-RFI-001-0. `number` holds everything except the revision.
export const docRef = (s: { number: string; revision: number }) => `${s.number}-${s.revision}`;
