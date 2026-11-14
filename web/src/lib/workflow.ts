import type { RefData } from './api';
import type { Doc, Profile, Transition } from './types';

export type Who = { profile: Profile; isManager: boolean; isFinance: boolean };

// The next steps this person may take on a document. Mirrors doc_actor_ok() in the database,
// which has the final say; this only decides which buttons to show.
export function nextSteps(doc: Doc, ref: RefData, who: Who): Transition[] {
  const kind = ref.docTypes.find((t) => t.code === doc.doc_type)?.review_kind;
  if (!kind) return [];
  return ref.transitions.filter((t) => {
    if (t.review_kind !== kind || t.from_status !== doc.status) return false;
    if (t.actor === 'reviewer') return who.profile.kind === 'internal' && (who.isManager || doc.reviewer_id === who.profile.id);
    if (t.actor === 'finance') return who.isFinance;
    if (t.actor === 'company') return who.profile.kind === 'external' && doc.company_id === who.profile.company_id;
    return false;
  });
}

export function canRevise(doc: Doc, ref: RefData, who: Who) {
  const kind = ref.docTypes.find((t) => t.code === doc.doc_type)?.review_kind;
  const allowed = ref.revisable.some((r) => r.review_kind === kind && r.status === doc.status);
  if (!allowed) return false;
  return who.profile.kind === 'internal' || doc.company_id === who.profile.company_id;
}

// Is this document waiting on this person right now?
export function waitingOnMe(doc: Doc, ref: RefData, who: Who) {
  if (doc.status === 'draft') return doc.created_by === who.profile.id;
  // "start review" alone doesn't count; managers see unassigned items separately
  const steps = nextSteps(doc, ref, who).filter((s) => s.to_status !== 'under_review');
  if (who.profile.kind === 'internal' && who.isManager && doc.reviewer_id && doc.reviewer_id !== who.profile.id
      && steps.every((s) => s.actor === 'reviewer')) return false;
  return steps.length > 0 || canRevise(doc, ref, who);
}

export const docTypeName = (ref: RefData | undefined, code: string) => ref?.docTypes.find((t) => t.code === code)?.name ?? code;
