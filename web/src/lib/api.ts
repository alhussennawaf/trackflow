import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { must, supabase } from './supabase';
import type {
  Comment, Company, Doc, DocType, FileRow, Invitation, Level, Member, Notice, Profile, Project, Revisable, Risk,
  SubTrade, Task, Trade, Transition,
} from './types';

// ------------------------------------------------------------------ reference data (small tables, loaded once)

export type RefData = {
  docTypes: DocType[];
  transitions: Transition[];
  revisable: Revisable[];
  trades: Trade[];
  subTrades: SubTrade[];
  levels: Level[];
  companies: Company[];
  projects: Project[];
  profiles: Profile[];
  members: Member[];
};

export function useRefData() {
  return useQuery({
    queryKey: ['ref'],
    staleTime: 60_000,
    queryFn: async (): Promise<RefData> => {
      const [docTypes, transitions, revisable, trades, subTrades, levels, companies, projects, profiles, members] = await Promise.all([
        supabase.from('doc_types').select('*').eq('active', true).order('sort').then(must),
        supabase.from('doc_transitions').select('*').then(must),
        supabase.from('doc_revisable').select('*').then(must),
        supabase.from('trades').select('*').order('sort').then(must),
        supabase.from('sub_trades').select('*').order('sort').then(must),
        supabase.from('levels').select('*').order('sort').then(must),
        supabase.from('companies').select('*').order('name').then(must),
        supabase.from('projects').select('*').order('code').then(must),
        supabase.from('profiles').select('*').order('full_name').then(must),
        supabase.from('project_members').select('project_id, profile_id').then(must),
      ]);
      return { docTypes, transitions, revisable, trades, subTrades, levels, companies, projects, profiles, members } as RefData;
    },
  });
}

export const byId = <T extends { id: string }>(rows: T[] | undefined, id: string | null | undefined) =>
  id ? rows?.find((r) => r.id === id) : undefined;

// ------------------------------------------------------------------ documents

export type DocFilter = { page?: 'requests' | 'reports'; projectId?: string; status?: string; type?: string; q?: string; mine?: string };

export function useDocuments(f: DocFilter, types: DocType[] | undefined) {
  return useQuery({
    queryKey: ['documents', f],
    enabled: !!types,
    queryFn: async () => {
      let q = supabase.from('documents').select('*').order('updated_at', { ascending: false }).limit(500);
      if (f.page && types) q = q.in('doc_type', types.filter((t) => t.page === f.page).map((t) => t.code));
      if (f.projectId) q = q.eq('project_id', f.projectId);
      if (f.type) q = q.eq('doc_type', f.type);
      if (f.status === 'open') q = q.in('status', ['submitted', 'under_review', 'responded', 'returned', 'on_hold', 'revise_resubmit']);
      else if (f.status === 'drafts') q = q.eq('status', 'draft');
      else if (f.status === 'done') q = q.in('status', ['approved', 'approved_as_noted', 'replied', 'paid', 'closed', 'rejected']);
      else if (f.status === 'all') { /* everything, including superseded revisions */ }
      else q = q.neq('status', 'superseded');
      if (f.q) q = q.or(`ref.ilike.%${f.q}%,title.ilike.%${f.q}%`);
      return must(await q) as Doc[];
    },
  });
}

export function useDocument(id: string | undefined) {
  return useQuery({
    queryKey: ['document', id],
    enabled: !!id,
    queryFn: async () => must(await supabase.from('documents').select('*').eq('id', id!).maybeSingle()) as Doc | null,
  });
}

export function useRevisions(rootId: string | null | undefined) {
  return useQuery({
    queryKey: ['revisions', rootId],
    enabled: !!rootId,
    queryFn: async () =>
      must(await supabase.from('documents').select('id, ref, revision, status, review_code, submitted_at').eq('root_id', rootId!).order('revision', { ascending: false })) as Pick<Doc, 'id' | 'ref' | 'revision' | 'status' | 'review_code' | 'submitted_at'>[],
  });
}

export function useComments(docId: string | undefined) {
  return useQuery({
    queryKey: ['comments', docId],
    enabled: !!docId,
    queryFn: async () => must(await supabase.from('doc_comments').select('*').eq('document_id', docId!).order('created_at')) as Comment[],
  });
}

// ------------------------------------------------------------------ files

export function useFiles(filter: { documentId?: string; projectId?: string; companyId?: string }) {
  return useQuery({
    queryKey: ['files', filter],
    queryFn: async () => {
      let q = supabase.from('files').select('*').order('created_at', { ascending: false });
      if (filter.documentId) q = q.eq('document_id', filter.documentId);
      if (filter.projectId) q = q.eq('project_id', filter.projectId);
      if (filter.companyId) q = q.eq('company_id', filter.companyId);
      return must(await q) as FileRow[];
    },
  });
}

// Create the file record first (the database decides the storage path and checks permission), then upload.
export async function uploadFile(
  file: File,
  owner: { document_id?: string; project_id?: string; company_id?: string; visibility?: FileRow['visibility']; shared_company_id?: string | null; folder?: string },
) {
  const row = must(
    await supabase
      .from('files')
      .insert({ name: file.name, mime: file.type, size: file.size, ...owner })
      .select()
      .single(),
  ) as FileRow;
  const up = await supabase.storage.from('files').upload(row.storage_path, file, { contentType: file.type || undefined, upsert: false });
  if (up.error) {
    await supabase.from('files').delete().eq('id', row.id);
    throw up.error;
  }
  return row;
}

export async function openFile(f: FileRow) {
  const { data, error } = await supabase.storage.from('files').createSignedUrl(f.storage_path, 120, { download: f.name });
  if (error) throw error;
  window.open(data.signedUrl, '_blank', 'noopener');
}

export async function deleteFile(f: FileRow) {
  await supabase.storage.from('files').remove([f.storage_path]);
  must(await supabase.from('files').delete().eq('id', f.id));
}

// ------------------------------------------------------------------ tasks, risks, notices, invitations

export function useTasks(projectId?: string) {
  return useQuery({
    queryKey: ['tasks', projectId],
    queryFn: async () => {
      let q = supabase.from('tasks').select('*').order('created_at', { ascending: false });
      if (projectId) q = q.eq('project_id', projectId);
      return must(await q) as Task[];
    },
  });
}

export function useRisks(projectId?: string) {
  return useQuery({
    queryKey: ['risks', projectId],
    queryFn: async () => {
      let q = supabase.from('risks').select('*').order('score', { ascending: false });
      if (projectId) q = q.eq('project_id', projectId);
      return must(await q) as Risk[];
    },
  });
}

export function useNotices() {
  return useQuery({
    queryKey: ['notices'],
    refetchInterval: 60_000,
    queryFn: async () => must(await supabase.from('notices').select('*').order('created_at', { ascending: false }).limit(50)) as Notice[],
  });
}

export function useInvitations(enabled: boolean) {
  return useQuery({
    queryKey: ['invitations'],
    enabled,
    queryFn: async () => must(await supabase.from('invitations').select('*').order('created_at', { ascending: false })) as Invitation[],
  });
}

// ------------------------------------------------------------------ mutations helper

// Runs an async action and refreshes the listed caches afterwards.
export function useAction<A, R>(fn: (a: A) => Promise<R>, refresh: string[][]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => Promise.all(refresh.map((k) => qc.invalidateQueries({ queryKey: k }))),
  });
}

export const rpc = {
  submit: async (id: string) => must(await supabase.rpc('submit_document', { p_id: id })) as Doc,
  act: async (a: { id: string; to: string; reply: string }) =>
    must(await supabase.rpc('act_on_document', { p_id: a.id, p_to: a.to, p_reply: a.reply })) as Doc,
  assign: async (a: { id: string; reviewer: string; due: string | null }) =>
    must(await supabase.rpc('assign_reviewer', { p_id: a.id, p_reviewer: a.reviewer, p_due: a.due })) as Doc,
  newRevision: async (id: string) => must(await supabase.rpc('new_revision', { p_id: id })) as Doc,
  invite: async (a: { email: string; company: string; name: string; projects: string[]; ends: string }) =>
    must(
      await supabase.rpc('invite_external', { p_email: a.email, p_company: a.company, p_name: a.name, p_projects: a.projects, p_ends: a.ends }),
    ) as Invitation,
};
