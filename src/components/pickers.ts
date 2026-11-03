import { ROLES } from '../data/catalog';
import { useStore } from '../data/store';
import type { Option } from './ui';

export function useOptions() {
  const { projects, profiles, contractors } = useStore();
  const projectOpts: Option[] = projects.map((p) => ({ value: p.id, label: p.name, sub: p.code }));
  const userOpts: Option[] = profiles.filter((u) => u.active).map((u) => ({ value: u.id, label: u.full_name, sub: u.title || ROLES[u.role] }));
  const contractorOpts: Option[] = contractors.map((c) => ({ value: c.id, label: c.name, sub: c.trade }));
  const withAll = (opts: Option[], label: string): Option[] => [{ value: '', label }, ...opts];
  return { projectOpts, userOpts, contractorOpts, withAll };
}

export const match = (q: string, ...fields: (string | undefined | null)[]) => {
  if (!q) return true;
  const hay = fields.join(' ').toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => hay.includes(w));
};
