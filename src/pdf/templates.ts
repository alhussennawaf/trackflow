import { docRef, submittalType, SUBMITTAL_STATUS } from '../data/catalog';
import type { Contractor, DailyReport, Profile, Project, Settings, Submittal } from '../data/types';
import { fmtDate } from '../lib/dates';
import { LOGO_DATA_URI } from './logoData';
import { esc } from './esc';

const NAVY = '#2C4F82';

function page(body: string, settings: Settings, landscape = false) {
  return `<!doctype html><html><head><meta charset="utf-8"/><title></title>
<style>
  @page { size: A4 ${landscape ? "landscape" : "portrait"}; margin: 12mm 12mm 10mm 12mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; color: #1b2430; font-size: 9.5pt; margin: 0; }
  .head { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid ${NAVY}; padding-bottom: 8px; }
  .head img { height: 58px; }
  .co { text-align: right; }
  .co .en { font-weight: 800; color: ${NAVY}; font-size: 13pt; }
  .co .ar { color: ${NAVY}; font-size: 12pt; direction: rtl; }
  .co .sub { color: #667085; font-size: 8.5pt; }
  .titlebar { margin-top: 10px; background: ${NAVY}; color: #fff; display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-radius: 4px; }
  .titlebar .t { font-weight: 800; font-size: 13pt; letter-spacing: .5px; }
  .titlebar .n { background: #fff; color: ${NAVY}; font-weight: 800; padding: 3px 10px; border-radius: 3px; font-size: 11pt; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  td, th { border: 1px solid #c9d2df; padding: 4px 7px; vertical-align: top; }
  th { background: #eef2f8; color: ${NAVY}; text-align: left; font-size: 9pt; text-transform: uppercase; letter-spacing: .4px; }
  td.k { background: #f6f8fb; color: #475467; width: 22%; font-size: 9pt; font-weight: 600; }
  .sec { margin-top: 10px; font-weight: 800; color: ${NAVY}; font-size: 10pt; text-transform: uppercase; letter-spacing: .6px; border-bottom: 1px solid #c9d2df; padding-bottom: 3px; }
  .box { border: 1px solid #c9d2df; min-height: 44px; padding: 6px 8px; margin-top: 6px; white-space: normal; }
  .codes { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
  .code { flex: 1; min-width: 150px; border: 1px solid #c9d2df; padding: 6px 8px; font-size: 9pt; display: flex; gap: 6px; align-items: center; }
  .cb { width: 12px; height: 12px; border: 1.5px solid #1b2430; display: inline-flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 900; line-height: 1; }
  .sig { display: flex; gap: 10px; margin-top: 12px; break-inside: avoid; page-break-inside: avoid; }
  .sig > div { flex: 1; border: 1px solid #c9d2df; padding: 8px; height: 80px; position: relative; font-size: 9pt; }
  .sig .r { color: #475467; font-weight: 700; text-transform: uppercase; font-size: 8pt; }
  .sig .l { position: absolute; bottom: 8px; left: 8px; right: 8px; border-top: 1px dotted #98a2b3; padding-top: 3px; color: #667085; font-size: 8pt; }
  .foot { position: fixed; bottom: 0; left: 0; right: 0; display: flex; justify-content: space-between; color: #98a2b3; font-size: 7.5pt; border-top: 1px solid #e4e7ec; padding-top: 4px; }
  .num { text-align: right; }
  .muted { color: #667085; }
</style></head><body>
${body}
<div class="foot"><span>${esc(settings.company_name)} · ${esc(settings.company_name_ar)}</span><span>Generated ${fmtDate(new Date().toISOString())} · JAK - flowTracker</span></div>
</body></html>`;
}

function letterhead(settings: Settings, title: string, number: string, project?: Project) {
  return `<div class="head">
  <img src="${LOGO_DATA_URI}" />
  <div class="co"><div class="en">${esc(settings.company_name)}</div><div class="ar">${esc(settings.company_name_ar)}</div>
  ${project ? `<div class="sub">${esc(project.name)} · ${esc(project.location)}</div>` : ''}</div>
</div>
<div class="titlebar"><span class="t">${esc(title)}</span>${number ? `<span class="n">${esc(number)}</span>` : ''}</div>`;
}

const cb = (on: boolean) => `<span class="cb">${on ? '✓' : ''}</span>`;

export function submittalHtml(s: Submittal, ctx: { project?: Project; contractor?: Contractor; settings: Settings; author?: Profile; assignee?: Profile }) {
  const t = submittalType(s.type);
  const p = ctx.project;
  const st = SUBMITTAL_STATUS[s.status];
  const isInspection = s.type === 'MIR' || s.type === 'WIR';
  const isRfi = s.type === 'RFI';

  const info = `<table>
  <tr><td class="k">Project</td><td>${esc(p?.name)}</td><td class="k">Project code</td><td>${esc(p?.code)}</td></tr>
  <tr><td class="k">Client</td><td>${esc(p?.client)}</td><td class="k">Consultant</td><td>${esc(p?.consultant)}</td></tr>
  <tr><td class="k">Contractor</td><td>${esc(ctx.contractor?.name ?? '')}</td><td class="k">Discipline</td><td>${esc(s.discipline)}</td></tr>
  <tr><td class="k">Reference no.</td><td><b>${esc(docRef(s))}</b></td><td class="k">Revision</td><td>${s.revision}</td></tr>
  <tr><td class="k">Date submitted</td><td>${fmtDate(s.submitted_date)}</td><td class="k">Response required by</td><td>${fmtDate(s.due_date)}</td></tr>
  <tr><td class="k">Subject</td><td colspan="3"><b>${esc(s.title)}</b></td></tr>
</table>`;

  const fieldRows = t.fields
    .filter((f) => !f.multiline)
    .map((f) => `<tr><td class="k">${esc(f.label)}</td><td>${esc(s.fields[f.key])}</td></tr>`)
    .join('');
  const longFields = t.fields
    .filter((f) => f.multiline)
    .map((f) => `<div class="sec">${esc(f.label)}</div><div class="box">${esc(s.fields[f.key]) || '&nbsp;'}</div>`)
    .join('');

  const attachments = s.attachments.length
    ? `<table><tr><th style="width:40px">#</th><th>Attachment</th></tr>${s.attachments
        .map((a, i) => `<tr><td>${i + 1}</td><td>${esc(a.name)}</td></tr>`)
        .join('')}</table>`
    : `<div class="box muted" style="min-height:24px">No attachments listed.</div>`;

  const review = isInspection
    ? `<div class="sec">Inspection result</div>
       <div class="codes">
         <div class="code">${cb(s.status === 'approved')} Accepted</div>
         <div class="code">${cb(s.status === 'approved_as_noted')} Accepted with comments</div>
         <div class="code">${cb(s.status === 'rejected' || s.status === 'revise_resubmit')} Rejected / re-inspect</div>
       </div>`
    : isRfi
      ? ''
      : `<div class="sec">Review action code</div>
       <div class="codes">
         <div class="code">${cb(s.status === 'approved')} <b>A</b> Approved</div>
         <div class="code">${cb(s.status === 'approved_as_noted')} <b>B</b> Approved as noted</div>
         <div class="code">${cb(s.status === 'revise_resubmit')} <b>C</b> Revise &amp; resubmit</div>
         <div class="code">${cb(s.status === 'rejected')} <b>D</b> Rejected</div>
       </div>`;

  const body = `
${letterhead(ctx.settings, `${t.name.toUpperCase()} (${t.code})`, docRef(s), p)}
${info}
${fieldRows ? `<div class="sec">${esc(t.name)} details</div><table>${fieldRows}</table>` : ''}
${s.description ? `<div class="sec">Description</div><div class="box">${esc(s.description)}</div>` : ''}
${longFields}
<div class="sec">Attachments</div>
${attachments}
${review}
<div class="sec">${isRfi ? 'Consultant response' : 'Consultant / engineer comments'}</div>
<div class="box" style="min-height:${isRfi ? 90 : 56}px">${esc(s.reply) || '&nbsp;'}</div>
<p class="muted" style="font-size:8.5pt;margin-top:6px">Current status: <b>${esc(st.label)}</b></p>
<div class="sig">
  <div><div class="r">Submitted by (Contractor)</div><div>${esc(ctx.author?.full_name ?? '')}</div><div class="muted">${esc(ctx.author?.title ?? '')}</div><div class="l">Signature &amp; date</div></div>
  <div><div class="r">${isInspection ? 'QA/QC inspector' : 'Reviewed by'}</div><div>${esc(ctx.assignee?.full_name ?? '')}</div><div class="muted">${esc(ctx.assignee?.title ?? '')}</div><div class="l">Signature &amp; date</div></div>
  <div><div class="r">Consultant / Engineer</div><div>${esc(p?.consultant ?? '')}</div><div class="l">Signature, stamp &amp; date</div></div>
</div>`;
  return page(body, ctx.settings);
}

export function dailyReportHtml(r: DailyReport, ctx: { project?: Project; settings: Settings; author?: Profile }) {
  const body = `
${letterhead(ctx.settings, 'DAILY SITE REPORT', fmtDate(r.date), ctx.project)}
<table>
  <tr><td class="k">Project</td><td>${esc(ctx.project?.name)}</td><td class="k">Date</td><td>${fmtDate(r.date)}</td></tr>
  <tr><td class="k">Weather</td><td>${esc(r.weather)}</td><td class="k">Manpower</td><td>${r.manpower}</td></tr>
  <tr><td class="k">Equipment</td><td colspan="3">${esc(r.equipment)}</td></tr>
</table>
<div class="sec">Work carried out</div><div class="box" style="min-height:140px">${esc(r.work_done)}</div>
<div class="sec">Issues / delays / safety</div><div class="box" style="min-height:80px">${esc(r.issues) || '&nbsp;'}</div>
<div class="sig">
  <div><div class="r">Prepared by</div><div>${esc(ctx.author?.full_name ?? '')}</div><div class="l">Signature &amp; date</div></div>
  <div><div class="r">Project manager</div><div class="l">Signature &amp; date</div></div>
</div>`;
  return page(body, ctx.settings);
}

export type PayrollRow = {
  user: Profile;
  workingDays: number;
  present: number;
  late: number;
  absent: number;
  leave: number;
  overtimeHours: number;
  basic: number;
  allowances: number;
  deductions: number;
  overtimePay: number;
  net: number;
};

export function payrollHtml(rows: PayrollRow[], monthLabel: string, settings: Settings) {
  const m = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const total = rows.reduce((a, r) => a + r.net, 0);
  const body = `
${letterhead(settings, `SALARY SHEET — ${monthLabel.toUpperCase()}`, settings.currency)}
<table>
<tr><th>Emp. no.</th><th>Name</th><th>Working days</th><th>Present</th><th>Late</th><th>Absent</th><th>Leave</th><th>OT hrs</th><th class="num">Basic</th><th class="num">Allowances</th><th class="num">Deductions</th><th class="num">Overtime</th><th class="num">Net pay</th></tr>
${rows
  .map(
    (r) =>
      `<tr><td>${esc(r.user.employee_no)}</td><td>${esc(r.user.full_name)}<div class="muted" style="font-size:8pt">${esc(r.user.title)}</div></td><td>${r.workingDays}</td><td>${r.present}</td><td>${r.late}</td><td>${r.absent}</td><td>${r.leave}</td><td>${r.overtimeHours.toFixed(1)}</td><td class="num">${m(r.basic)}</td><td class="num">${m(r.allowances)}</td><td class="num">${m(r.deductions)}</td><td class="num">${m(r.overtimePay)}</td><td class="num"><b>${m(r.net)}</b></td></tr>`,
  )
  .join('')}
<tr><td colspan="12" class="num"><b>Total</b></td><td class="num"><b>${m(total)}</b></td></tr>
</table>
<p class="muted" style="font-size:8.5pt">Absent days are deducted at basic ÷ 30 per day. Each late arrival deducts ${settings.late_deduction_ratio * 100}% of a day. Overtime is paid at ${settings.overtime_rate}× the hourly rate beyond ${settings.work_hours} hours a day.</p>
<div class="sig">
  <div><div class="r">Prepared by (HR)</div><div class="l">Signature &amp; date</div></div>
  <div><div class="r">Checked by (Accounts)</div><div class="l">Signature &amp; date</div></div>
  <div><div class="r">Approved by (CEO)</div><div class="l">Signature &amp; date</div></div>
</div>`;
  return page(body, settings, true);
}
