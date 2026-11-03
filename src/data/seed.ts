import { addDays, ymd } from '../lib/dates';
import { roleForTitle } from '../lib/employeeImport';
import { SEED_PHOTOS } from './seedPhotos';
import { TRACKER_CONTRACTORS, TRACKER_DOCS } from './trackerData';
import type {
  Attendance,
  Contractor,
  DailyReport,
  DocumentFile,
  Notice,
  Photo,
  Profile,
  Project,
  Settings,
  Submittal,
  Task,
} from './types';

export const DEMO_PASSWORD = 'demo1234';

// Deterministic ids so demo links stay stable.
const id = (prefix: string, n: number) => `${prefix}-0000-4000-8000-${String(n).padStart(12, '0')}`;

export const DEFAULT_SETTINGS: Settings = {
  id: 'company',
  work_start: '07:00',
  grace_minutes: 15,
  work_hours: 8,
  weekend_days: [5], // Friday
  late_deduction_ratio: 0.25,
  overtime_rate: 1.5,
  currency: 'SAR',
  company_name: 'Jadah Al Khozama International',
  company_name_ar: 'جادة الخزامى الدولية',
  doc_prefix: 'JAK',
  employee_prefix: 'JAK-EMP',
};

export function buildSeed() {
  const now = new Date();
  const d = (n: number) => ymd(addDays(now, n));
  const iso = (n: number) => addDays(now, n).toISOString();

  // Staff list (names, positions, employee numbers). Salaries, ID and bank details are not built into the app:
  // HR imports them from the payroll directory (Team & Users → Import Excel).
  const staff: [string, string, string, string, string][] = [
    ['JAK-EMP-001', 'Ahmad Alnajem', 'CEO', 'Management', '2024-03-02'],
    ['JAK-EMP-015', 'Vowaisy Shaik Babu Shaik', 'Project Lead - Sky Loft & Almalaz Project', 'Civil', '2026-06-02'],
    ['JAK-EMP-006', 'Meshkel Aziz', 'Civil Engineer', 'Civil', '2024-05-18'],
    ['JAK-EMP-003', 'Haitham Haider Al-Sanawi', 'Structural Engineer', 'Civil', '2024-02-28'],
    ['JAK-EMP-011', 'Mohammed Hassan Abu Khair', 'Electrical Engineer', 'MEP Dept.', '2025-06-15'],
    ['JAK-EMP-010', 'Sakhawat Ali Abdul Hameed', 'Surveyor', 'Civil', '2025-07-01'],
    ['JAK-EMP-012', 'Meshal', 'Accountant', 'Finance Dept.', ''],
    ['JAK-EMP-005', 'Muhammad Kamran', 'Project Secretary', 'Administration', '2024-02-24'],
    ['JAK-EMP-002', 'Ali Alruways', 'Procurement Manager', 'Procurement Dept.', '2024-03-02'],
    ['JAK-EMP-004', 'Abdulmohsin Alharbi', 'Planning Engineer', 'Planning Dept.', '2026-03-02'],
    ['JAK-EMP-007', 'Hamad Salaheldin Mohamed Khier Ibrahim', 'Project Manager - ZAC', 'Architecture Dept.', '2024-06-22'],
    ['JAK-EMP-008', 'Salah Thabet', 'MEP Dept. Manager', 'MEP Dept.', '2026-07-01'],
    ['JAK-EMP-009', 'Hashem Kamal Hashem Abdalbaky', 'Architect', 'Architecture Dept.', '2025-01-10'],
    ['JAK-EMP-013', 'Waleed Alsabagh', 'Project Manager - Inspire', 'Civil', '2026-02-01'],
    ['JAK-EMP-014', 'Razin Ahmed', 'Project Engineer', 'Civil', '2026-04-01'],
    ['JAK-EMP-016', 'Abdullah Alsakran', 'Project Coordinator', 'Administration', '2026-06-02'],
    ['JAK-EMP-017', 'Naveed Akram', 'Planning Manager', 'Planning Dept.', '2025-11-01'],
    ['JAK-EMP-018', 'Inzmam Masood', 'Project Coordinator & Document Controller', 'Administration', '2026-06-30'],
    ['JAK-EMP-019', 'Nawaf', 'IT Intern', 'Administration', '2026-06-15'],
    ['JAK-EMP-020', 'Mohamed Abdel Wahab Mohamed Hegab', 'Project Management Director', 'Administration', '2026-07-11'],
    ['JAK-EMP-021', 'Ahmed Eid Ali Abo Rehab', 'QHSE Manager', 'HSE', '2026-07-22'],
  ];
  const profiles: Profile[] = staff.map(([employee_no, full_name, title, department, joining_date], i) => ({
    id: id('u0000000', i + 1),
    email: i === 0 ? 'admin@jak.demo' : `${employee_no.toLowerCase()}@jak.demo`,
    full_name,
    role: roleForTitle(title),
    title,
    phone: '',
    employee_no,
    department,
    work_location: 'Riyadh',
    joining_date,
    monthly_salary: 0,
    active: true,
    created_at: iso(-200),
  }));
  const U = profiles.map((p) => p.id);

  const projects: Project[] = [
    {
      id: id('p0000000', 1),
      code: 'MLZ',
      name: 'Al Malaz Project',
      client: 'Private client',
      consultant: 'Riyadh Design Consultants',
      location: 'Al Malaz, Riyadh',
      status: 'active',
      start_date: d(-160),
      end_date: d(260),
      progress: 42,
      value: 18500000,
      description: '24 villas with basement, swimming pools, landscaping and boundary wall.',
      member_ids: U.slice(0, 18),
      created_at: iso(-160),
    },
    {
      id: id('p0000000', 2),
      code: 'SKY',
      name: 'Sky Loft',
      client: 'Gulf Horizon Holding',
      consultant: 'Saudi Engineering Group',
      location: 'Riyadh',
      status: 'active',
      start_date: d(-60),
      end_date: d(120),
      progress: 18,
      value: 6200000,
      description: 'Sample data: edit the project details to match the real project.',
      member_ids: U.slice(0, 18),
      created_at: iso(-60),
    },
    {
      id: id('p0000000', 3),
      code: 'VLC',
      name: 'Villas Compound',
      client: '',
      consultant: '',
      location: 'Riyadh',
      status: 'active',
      start_date: '2024-02-19',
      end_date: '',
      progress: 0,
      value: 0,
      description: 'Khalid, Waleed, Mohammad, Ziad, Omar and Mother villas, Family Common, Pool & Spa, Wadi Park and Shad Pavilion. Documents loaded from the Document Control Tracker (15-10-2026).',
      member_ids: U.slice(0, 18),
      created_at: '2024-02-19T08:00:00.000Z',
    },
  ];
  const P = projects.map((p) => p.id);

  const contractors: Contractor[] = [
    ['Al Bunyan Concrete Works', 'Concrete & Structure', 'subcontractor', 'Majed Al-Shehri', [P[0]]],
    ['Najd MEP Contracting', 'MEP', 'subcontractor', 'Imran Ali', [P[0], P[1]]],
    ['Riyadh Ready Mix', 'Ready-mix concrete', 'supplier', 'Sales Desk', [P[0]]],
    ['Gulf Interiors', 'Fit-out & joinery', 'subcontractor', 'Hassan Nabil', [P[1]]],
    ['Eastern Steel Buildings', 'Pre-engineered steel', 'subcontractor', 'Yousef Al-Mutairi', [P[1]]],
  ].map(([name, trade, kind, contact, pids], i) => ({
    id: id('c0000000', i + 1),
    name: name as string,
    trade: trade as string,
    kind: kind as Contractor['kind'],
    contact_person: contact as string,
    phone: `+966 11 400 00${i}0`,
    email: `info@${(name as string).toLowerCase().split(' ').slice(0, 2).join('').replace(/[^a-z]/g, '')}.example`,
    cr_number: `10100${i}4521`,
    vat_number: `3001${i}29873000003`,
    project_ids: pids as string[],
    created_at: iso(-150 + i),
  }));
  // Contractors from the Document Control Tracker, filed under the villas project.
  TRACKER_CONTRACTORS.forEach(([name, code], i) =>
    contractors.push({
      id: id('c1000000', i + 1),
      name,
      code,
      trade: '',
      kind: 'subcontractor',
      contact_person: '',
      phone: '',
      email: '',
      cr_number: '',
      vat_number: '',
      project_ids: [P[2]],
      created_at: '2024-02-19T08:00:00.000Z',
    }),
  );
  const C = contractors.map((c) => c.id);

  const tasks: Task[] = [
    [P[0], 'Pour slab level 1, villas 5–8', U[2], 'in_progress', 'high', 2, 'Villas 5–8'],
    [P[0], 'Prepare MIR for block delivery', U[3], 'todo', 'medium', 1, 'Store yard'],
    [P[0], 'Close NCR-002 honeycombing at column C4', U[2], 'review', 'urgent', -1, 'Villa 3'],
    [P[0], 'Coordinate sleeves before slab pour', U[4], 'in_progress', 'high', 3, 'Villas 5–8'],
    [P[0], 'Toolbox talk: working at height', U[5], 'done', 'medium', -3, 'Site office'],
    [P[1], 'Submit ceiling shop drawings floor 12', U[3], 'todo', 'high', 5, 'Level 12'],
    [P[1], 'Chase consultant reply on RFI-001', U[1], 'todo', 'medium', -2, ''],
    [P[1], 'Duct testing floor 12', U[4], 'blocked', 'medium', 7, 'Level 12'],
    [P[2], 'Soil investigation report review', U[1], 'todo', 'medium', 14, ''],
    [P[0], 'Daily safety walk', U[5], 'todo', 'low', 0, 'Whole site'],
  ].map(([pid, title, who, status, priority, due, loc], i) => ({
    id: id('t0000000', i + 1),
    project_id: pid as string,
    title: title as string,
    description: '',
    assignee_id: who as string,
    created_by: U[1],
    status: status as Task['status'],
    priority: priority as Task['priority'],
    due_date: d(due as number),
    location: loc as string,
    created_at: iso(-10 + i),
  }));

  const sub = (
    n: number,
    pid: string,
    cid: string,
    type: string,
    number: string,
    title: string,
    discipline: string,
    status: Submittal['status'],
    submitted: number,
    fields: Record<string, string>,
    assigned: string,
  ): Submittal => ({
    id: id('s0000000', n),
    project_id: pid,
    contractor_id: cid,
    type,
    number,
    revision: 0,
    title,
    discipline,
    description: '',
    fields,
    status,
    submitted_date: d(submitted),
    due_date: d(submitted + 14),
    assigned_to: assigned,
    created_by: U[3],
    reply: status === 'approved_as_noted' ? 'Approved subject to comments marked on drawings 103 and 107.' : '',
    attachments: [],
    created_at: iso(submitted),
  });

  const submittals: Submittal[] = [
    sub(1, P[0], C[0], 'SD', 'JAK-MLZ-SD-001', 'Villa type A — slab reinforcement', 'Structural', 'approved_as_noted', -40, { drawing_numbers: 'S-101 to S-112', sheets: '12', reference_spec: '03 20 00' }, U[3]),
    sub(2, P[0], C[2], 'MAS', 'JAK-MLZ-MAS-004', 'Ready-mix concrete C40 mix design', 'Civil', 'approved', -55, { material: 'C40 concrete', manufacturer: 'Riyadh Ready Mix', supplier: 'Riyadh Ready Mix', country_of_origin: 'KSA', reference_spec: '03 30 00' }, U[3]),
    sub(3, P[0], C[0], 'MIR', 'JAK-MLZ-MIR-012', 'Rebar 16mm delivery inspection', 'Structural', 'submitted', -1, { material: 'Deformed rebar Ø16, grade 60', supplier: 'SABIC Hadeed', quantity: '24 tons', delivery_note: 'DN-55821', mas_ref: 'JAK-MLZ-MAS-002', storage_location: 'Yard B', inspection_date: d(0) + ' 09:00' }, U[3]),
    sub(4, P[0], C[0], 'WIR', 'JAK-MLZ-WIR-031', 'Slab L1 rebar before casting, villas 5–8', 'Structural', 'under_review', -2, { activity: 'Slab reinforcement', location: 'Villas 5–8, Level 1', drawing_ref: 'S-104 rev B', inspection_date: d(1) + ' 08:00' }, U[2]),
    sub(5, P[0], C[1], 'RFI', 'JAK-MLZ-RFI-007', 'Clash between AC drain and beam B12', 'Mechanical', 'submitted', -3, { question: 'AC condensate drain clashes with beam B12 at grid C/4. Please confirm whether the drain may pass through a sleeve in the beam.', proposed_solution: 'Provide 75mm sleeve at mid-depth of beam, approved by structural engineer.', drawing_ref: 'M-201, S-104', cost_impact: 'No', time_impact: 'No' }, U[4]),
    sub(6, P[0], C[0], 'NCR', 'JAK-MLZ-NCR-002', 'Honeycombing at column C4', 'Structural', 'under_review', -6, { location: 'Villa 3, column C4', non_conformance: 'Honeycombing found after formwork removal.', root_cause: 'Insufficient vibration.', corrective_action: 'Repair with approved non-shrink grout.', close_by: d(3) }, U[2]),
    sub(7, P[1], C[3], 'SD', 'JAK-SKY-SD-003', 'Level 12 reflected ceiling plan', 'Architectural', 'revise_resubmit', -12, { drawing_numbers: 'A-512', sheets: '1' }, U[3]),
    sub(8, P[1], C[1], 'RFI', 'JAK-SKY-RFI-001', 'Fire damper access panels', 'HVAC', 'submitted', -9, { question: 'Access panel size for fire dampers is not shown. Please confirm.', proposed_solution: '600x600 panels in gypsum ceiling.', cost_impact: 'TBD', time_impact: 'No' }, U[1]),
    sub(9, P[1], C[3], 'MS', 'JAK-SKY-MS-002', 'Gypsum board partition installation', 'Architectural', 'approved', -30, { activity: 'Partitions', risk_assessment: 'RA-014' }, U[3]),
    sub(10, P[0], C[1], 'MAS', 'JAK-MLZ-MAS-009', 'PPR pipes and fittings', 'Plumbing', 'draft', 0, { material: 'PPR PN20 pipes', manufacturer: 'Al Watania', supplier: 'Najd MEP', country_of_origin: 'KSA' }, U[4]),
  ];

  // Document Control Tracker log (3,500+ submittals) for the villas project.
  const byEmpNo = new Map(profiles.map((p) => [p.employee_no, p.id]));
  const controller = byEmpNo.get('JAK-EMP-018') ?? U[0];
  TRACKER_DOCS.forEach(([number, revision, ci, building, title, status, discipline, eng, engText, submitted, responded, type, trackerStatus], i) => {
    const sent = submitted || '2024-01-01';
    const f: Record<string, string> = {};
    if (engText) f.concerned_engineer = engText;
    if (trackerStatus) f.tracker_status = trackerStatus;
    submittals.push({
      id: id('s1000000', i + 1),
      project_id: P[2],
      contractor_id: ci >= 0 ? id('c1000000', ci + 1) : '',
      type,
      number,
      revision,
      title,
      discipline,
      description: '',
      fields: f,
      status: status as Submittal['status'],
      submitted_date: submitted,
      due_date: responded || ymd(addDays(new Date(sent + 'T12:00:00'), 7)),
      responded_date: responded,
      building,
      assigned_to: (eng && byEmpNo.get(eng)) || '',
      created_by: controller,
      reply: trackerStatus,
      attachments: [],
      created_at: new Date(sent + 'T08:00:00').toISOString(),
    });
  });

  const documents: DocumentFile[] = [
    [C[0], P[0], 'documents', 'Commercial Registration.pdf'],
    [C[0], P[0], 'documents', 'VAT Certificate.pdf'],
    [C[0], P[0], 'contracts', 'Subcontract Agreement - Structure.pdf'],
    [C[1], P[0], 'contracts', 'MEP Subcontract.pdf'],
    [C[3], P[1], 'documents', 'Company Profile.pdf'],
  ].map(([cid, pid, folder, name], i) => ({
    id: id('d0000000', i + 1),
    contractor_id: cid,
    project_id: pid,
    folder: folder as DocumentFile['folder'],
    name,
    url: '',
    mime: 'application/pdf',
    size: 240000 + i * 1000,
    amount: 0,
    invoice_status: '',
    notes: '',
    uploaded_by: U[1],
    created_at: iso(-100 + i),
  }));
  documents.push(
    ...[
      [C[0], P[0], 'INV-1021 Progress claim 3', 412500, 'paid', -45],
      [C[0], P[0], 'INV-1034 Progress claim 4', 386200, 'approved', -12],
      [C[1], P[0], 'INV-77 MEP rough-in', 154000, 'pending', -4],
      [C[2], P[0], 'RM-5541 Concrete supply Sept', 98700, 'paid', -30],
    ].map(([cid, pid, name, amount, st, ago], i) => ({
      id: id('d0000001', i + 1),
      contractor_id: cid as string,
      project_id: pid as string,
      folder: 'invoices' as const,
      name: name as string,
      url: '',
      mime: 'application/pdf',
      size: 120000,
      amount: amount as number,
      invoice_status: st as DocumentFile['invoice_status'],
      notes: '',
      uploaded_by: U[6],
      created_at: iso(ago as number),
    })),
  );

  // Attendance for the current month up to yesterday, with a believable pattern.
  const attendance: Attendance[] = [];
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  let n = 0;
  for (let day = new Date(first); ymd(day) < ymd(now); day = addDays(day, 1)) {
    if (DEFAULT_SETTINGS.weekend_days.includes(day.getDay())) continue;
    profiles.forEach((p, ui) => {
      const r = (day.getDate() * 7 + ui * 13) % 23;
      let status: Attendance['status'] = 'present';
      let mins = 50 + ((day.getDate() + ui) % 20); // 06:50 – 07:09
      if (r === 3) status = 'absent';
      else if (r === 5 || r === 11) {
        status = 'late';
        mins = 80 + ((day.getDate() * ui) % 40);
      } else if (r === 17 && ui % 2 === 0) status = 'leave';
      const inT = new Date(day);
      inT.setHours(6, mins, 0, 0);
      const outT = new Date(day);
      outT.setHours(15 + (r % 3 === 0 ? 2 : 0), (ui * 7) % 60, 0, 0);
      const worked = status === 'present' || status === 'late';
      attendance.push({
        id: id('a0000000', ++n),
        user_id: p.id,
        date: ymd(day),
        check_in: worked ? inT.toISOString() : '',
        check_out: worked ? outT.toISOString() : '',
        status,
        project_id: ui < 6 ? P[ui % 2] : '',
        latitude: null,
        longitude: null,
        notes: '',
        created_at: inT.toISOString(),
      });
    });
  }

  const photoMeta: [string, string, string, string, string][] = [
    [P[0], 'Slab rebar ready for inspection', 'Concrete Structure', 'First Floor', 'Inspections'],
    [P[0], 'Blockwork progress villa 2', 'Blockwork', 'Ground Floor', 'Progress'],
    [P[0], 'Completed facade, villa 1', 'Facade', 'External Area', 'Progress'],
    [P[0], 'Basement excavation and rebar', 'Excavation & Earthworks', 'Basement', 'Progress'],
    [P[0], 'Column formwork', 'Concrete Structure', 'Ground Floor', 'Progress'],
    [P[1], 'Level 12 framing', 'Plaster & Finishes', 'First Floor', 'Progress'],
    [P[0], 'Mock-up finished', 'Facade', 'External Area', 'Before / After'],
    [P[0], 'Foundation reinforcement', 'Foundations', 'Basement', 'Quality / Snags'],
  ];
  const photos: Photo[] = photoMeta.map(([pid, caption, scope, section, category], i) => ({
    id: id('f0000000', i + 1),
    project_id: pid,
    url: SEED_PHOTOS[i % SEED_PHOTOS.length],
    caption,
    scope,
    section,
    category,
    taken_at: iso(-i * 3),
    uploaded_by: U[2],
    created_at: iso(-i * 3),
  }));

  const notices: Notice[] = [
    { id: id('n0000000', 1), user_id: U[2], title: 'New task assigned', body: 'Pour slab level 1, villas 5–8', link: `task:${tasks[0].id}`, read: false, created_at: iso(-1) },
    { id: id('n0000000', 2), user_id: U[3], title: 'Submittal returned: Revise & resubmit', body: 'JAK-SKY-SD-003-0 Level 12 reflected ceiling plan', link: `submittal:${submittals[6].id}`, read: false, created_at: iso(-2) },
    { id: id('n0000000', 3), user_id: U[1], title: 'RFI awaiting reply for 9 days', body: 'JAK-SKY-RFI-001-0 Fire damper access panels', link: `submittal:${submittals[7].id}`, read: false, created_at: iso(-1) },
  ];

  const daily_reports: DailyReport[] = [
    { id: id('r0000000', 1), project_id: P[0], date: d(-1), weather: 'Sunny, 34°C', manpower: 46, equipment: '1 tower crane, 2 mixers, 1 pump', work_done: 'Slab rebar villas 5–8. Blockwork villa 2 ground floor. Sleeves coordination.', issues: 'Pump breakdown 2 hours.', created_by: U[2], created_at: iso(-1) },
  ];

  return {
    profiles,
    projects,
    tasks,
    submittals,
    contractors,
    documents,
    attendance,
    photos,
    notices,
    daily_reports,
    settings: [DEFAULT_SETTINGS] as Settings[],
  };
}
