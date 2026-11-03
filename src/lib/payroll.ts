import { allowancesOf, type Attendance, type Profile, type Settings } from '../data/types';
import type { PayrollRow } from '../pdf/templates';
import { daysInMonth, pad, ymd } from './dates';

export function isLate(checkIn: Date, s: Settings) {
  const [h, m] = s.work_start.split(':').map(Number);
  const limit = new Date(checkIn);
  limit.setHours(h, m + s.grace_minutes, 0, 0);
  return checkIn > limit;
}

export function hoursWorked(a: Attendance) {
  if (!a.check_in || !a.check_out) return 0;
  return Math.max(0, (new Date(a.check_out).getTime() - new Date(a.check_in).getTime()) / 3600000);
}

export function workingDaysInMonth(y: number, m: number, s: Settings, upTo?: Date) {
  let n = 0;
  const last = daysInMonth(y, m);
  for (let d = 1; d <= last; d++) {
    const date = new Date(y, m, d);
    if (upTo && date > upTo) break;
    if (!s.weekend_days.includes(date.getDay())) n++;
  }
  return n;
}

export const monthKey = (y: number, m: number) => `${y}-${pad(m + 1)}`;

// Monthly salary sheet. A working day with no attendance record counts as absent
// once it has passed. Daily rate = basic ÷ 30 (Saudi labour practice).
export function computePayroll(users: Profile[], attendance: Attendance[], y: number, m: number, s: Settings): PayrollRow[] {
  const key = monthKey(y, m);
  const now = new Date();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const monthEnd = new Date(y, m, daysInMonth(y, m));
  const countTo = monthEnd < yesterday ? monthEnd : yesterday;
  const workingDays = workingDaysInMonth(y, m, s);
  const elapsedWorking = workingDaysInMonth(y, m, s, countTo);

  return users.map((u) => {
    const rows = attendance.filter((a) => a.user_id === u.id && a.date.startsWith(key));
    const byDate = new Map(rows.map((a) => [a.date, a]));
    let present = 0,
      late = 0,
      absent = 0,
      leave = 0,
      ot = 0;
    for (let d = 1; d <= daysInMonth(y, m); d++) {
      const date = new Date(y, m, d);
      const a = byDate.get(ymd(date));
      const weekend = s.weekend_days.includes(date.getDay());
      if (a) {
        if (a.status === 'present') present++;
        else if (a.status === 'late') {
          present++;
          late++;
        } else if (a.status === 'absent') absent++;
        else if (a.status === 'leave' || a.status === 'sick' || a.status === 'holiday') leave++;
        ot += Math.max(0, hoursWorked(a) - s.work_hours);
        if (weekend && (a.status === 'present' || a.status === 'late')) ot += Math.min(hoursWorked(a), s.work_hours);
      } else if (!weekend && date <= countTo) absent++;
    }
    const daily = u.monthly_salary / 30;
    const hourly = daily / s.work_hours;
    const deductions = absent * daily + late * daily * s.late_deduction_ratio;
    const overtimePay = ot * hourly * s.overtime_rate;
    return {
      user: u,
      workingDays: elapsedWorking < workingDays ? elapsedWorking : workingDays,
      present,
      late,
      absent,
      leave,
      overtimeHours: Math.round(ot * 10) / 10,
      basic: u.monthly_salary,
      allowances: allowancesOf(u),
      deductions,
      overtimePay,
      net: Math.max(0, u.monthly_salary + allowancesOf(u) - deductions + overtimePay),
    };
  });
}
