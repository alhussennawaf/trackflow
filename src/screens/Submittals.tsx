import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useNav } from '../components/nav';
import { match, useOptions } from '../components/pickers';
import { Grid, Screen } from '../components/Screen';
import { Avatar, Badge, Button, Card, Chips, confirm, Empty, errorText, Field, H2, KV, Paged, Row, SearchBar, Select, Sheet, T, toast, useWide } from '../components/ui';
import { backend } from '../data/backend';
import { DISCIPLINES, docRef, SUBMITTAL_STATUS, SUBMITTAL_TYPES, submittalType } from '../data/catalog';
import { useStore } from '../data/store';
import type { Attachment, Submittal, SubmittalStatus } from '../data/types';
import { addDays, fmtDate, today, ymd } from '../lib/dates';
import { fmtSize, openFile, pickDocuments } from '../lib/files';
import { fileStamp, saveXlsx, submittalSheet } from '../lib/exports';
import { exportPdf } from '../pdf/output';
import { submittalHtml } from '../pdf/templates';
import { useTheme } from '../theme/ThemeContext';
import { DueLabel } from './Tasks';

const withoutIds = ({ id: _id, created_at: _c, ...rest }: Submittal) => rest;

// Document numbers look like JAK-MLZ-RFI-001 (company, project, type, serial); the revision is added when shown.
export function nextNumber(all: Submittal[], docPrefix: string, projectCode: string, type: string) {
  const prefix = `${[docPrefix, projectCode, type].filter(Boolean).join('-')}-`;
  const max = all
    .filter((s) => s.number.startsWith(prefix))
    .map((s) => parseInt(s.number.slice(prefix.length), 10) || 0)
    .reduce((a, b) => Math.max(a, b), 0);
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

export function useSubmittalPdf() {
  const { projects, contractors, settings, user } = useStore();
  return async (s: Submittal) => {
    try {
      const html = submittalHtml(s, {
        project: projects.find((p) => p.id === s.project_id),
        contractor: contractors.find((c) => c.id === s.contractor_id),
        settings,
        author: user(s.created_by),
        assignee: user(s.assigned_to),
      });
      await exportPdf(html, `${docRef(s)} - ${s.title}`);
    } catch (e) {
      toast(errorText(e), 'danger');
    }
  };
}

export function SubmittalRow({ s, compact }: { s: Submittal; compact?: boolean }) {
  const { c } = useTheme();
  const nav = useNav();
  const wide = useWide() && !compact;
  const { projects, contractors, user } = useStore();
  const p = projects.find((x) => x.id === s.project_id);
  const con = contractors.find((x) => x.id === s.contractor_id);
  const st = SUBMITTAL_STATUS[s.status];
  const t = submittalType(s.type);
  const open = !['approved', 'approved_as_noted', 'rejected', 'replied', 'closed', 'draft'].includes(s.status);
  return (
    <Pressable
      onPress={() => nav.push({ name: 'submittal', id: s.id })}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 14,
        borderBottomWidth: 1,
        borderColor: c.border,
        backgroundColor: pressed ? c.surfaceAlt : 'transparent',
      })}
    >
      <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={t.icon as 'map-outline'} size={18} color={c.primary} />
        <T size={9} weight="800" color={c.primary}>
          {s.type}
        </T>
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Row gap={8}>
          <T size={12} weight="700" color={c.primary}>
            {docRef(s)}
          </T>
          {!wide && <Badge label={st.label} tone={st.tone} />}
        </Row>
        <T weight="600" numberOfLines={1}>
          {s.title}
        </T>
        <T size={12} muted numberOfLines={1}>
          {[con?.name ?? 'No contractor', s.building || p?.name, s.discipline].filter(Boolean).join(' · ')}
        </T>
      </View>
      {wide && (
        <View style={{ width: 130 }}>
          <T size={12} muted>
            Submitted
          </T>
          <T size={13}>{fmtDate(s.submitted_date)}</T>
        </View>
      )}
      {wide && <View style={{ width: 120 }}>{open ? <DueLabel date={s.due_date} /> : <T size={12} muted>—</T>}</View>}
      {wide && <Avatar name={user(s.assigned_to)?.full_name} size={28} />}
      {wide && (
        <View style={{ width: 150, alignItems: 'flex-end' }}>
          <Badge label={st.code ? `${st.code} · ${st.label}` : st.label} tone={st.tone} />
        </View>
      )}
    </Pressable>
  );
}

/* --------------------------------- Form --------------------------------- */

type Draft = Omit<Submittal, 'id' | 'created_at'>;

export function SubmittalForm({
  visible,
  onClose,
  existing,
  defaults,
}: {
  visible: boolean;
  onClose: () => void;
  existing?: Submittal;
  defaults?: Partial<Draft>;
}) {
  const { c } = useTheme();
  const nav = useNav();
  const { submittals, projects, me, insert, update, notify, settings } = useStore();
  const { projectOpts, userOpts, contractorOpts } = useOptions();
  const [step, setStep] = useState<'type' | 'form'>(existing || defaults?.type ? 'form' : 'type');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const blank = (): Draft => ({
    project_id: projects[0]?.id ?? '',
    contractor_id: '',
    type: 'SD',
    number: '',
    revision: 0,
    title: '',
    discipline: 'General',
    description: '',
    fields: {},
    status: 'draft',
    submitted_date: today(),
    due_date: ymd(addDays(new Date(), 14)),
    assigned_to: '',
    created_by: me.id,
    reply: '',
    attachments: [],
    ...defaults,
  });
  const [f, setF] = useState<Draft>(existing ?? blank());

  useEffect(() => {
    if (!visible) return;
    setF(existing ?? blank());
    setStep(existing || defaults?.type ? 'form' : 'type');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, existing]);

  const t = submittalType(f.type);
  const project = projects.find((p) => p.id === f.project_id);
  const autoNumber = project ? nextNumber(submittals, settings.doc_prefix, project.code, f.type) : '';
  const set = <K extends keyof Draft>(k: K) => (v: Draft[K]) => setF((x) => ({ ...x, [k]: v }));
  const setField = (k: string) => (v: string) => setF((x) => ({ ...x, fields: { ...x.fields, [k]: v } }));

  const addFiles = async () => {
    try {
      setUploading(true);
      const files = await pickDocuments();
      const added: Attachment[] = [];
      for (const file of files) {
        const url = await backend.upload(`submittals/${f.project_id}`, file.name, file.dataUri);
        added.push({ name: file.name, url, mime: file.mime, size: file.size });
      }
      setF((x) => ({ ...x, attachments: [...x.attachments, ...added] }));
    } catch (e) {
      toast(errorText(e), 'danger');
    } finally {
      setUploading(false);
    }
  };

  const save = async (status: SubmittalStatus) => {
    if (!f.title.trim()) return toast('Enter a subject / title', 'warning');
    if (!f.project_id) return toast('Pick a project', 'warning');
    setBusy(true);
    try {
      const row = { ...f, status: existing ? f.status : status, number: f.number || autoNumber };
      if (existing) {
        await update('submittals', existing.id, row);
        toast('Submittal saved');
        onClose();
      } else {
        const saved = await insert('submittals', row);
        if (row.assigned_to) notify(row.assigned_to, `${row.type} assigned to you for review`, `${docRef(row)} ${row.title}`, `submittal:${saved.id}`);
        toast(`${docRef(row)} created`);
        onClose();
        nav.push({ name: 'submittal', id: saved.id });
      }
    } catch (e) {
      toast(errorText(e), 'danger');
    } finally {
      setBusy(false);
    }
  };

  if (step === 'type')
    return (
      <Sheet visible={visible} onClose={onClose} title="What are you submitting?" wide>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {SUBMITTAL_TYPES.map((x) => (
            <Pressable
              key={x.code}
              onPress={() => {
                setF((d) => ({ ...d, type: x.code, fields: {} }));
                setStep('form');
              }}
              style={({ pressed }) => ({
                flexGrow: 1,
                flexBasis: 200,
                padding: 14,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: c.border,
                backgroundColor: pressed ? c.primarySoft : c.surface,
                flexDirection: 'row',
                gap: 12,
                alignItems: 'center',
              })}
            >
              <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={x.icon as 'map-outline'} size={20} color={c.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <T weight="800" color={c.primary}>
                  {x.code}
                </T>
                <T size={13}>{x.name}</T>
              </View>
            </Pressable>
          ))}
        </View>
      </Sheet>
    );

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      wide
      title={existing ? `Edit ${docRef(existing)}` : `New ${t.name} (${t.code})`}
      footer={
        existing ? (
          <>
            <Button title="Cancel" variant="ghost" onPress={onClose} />
            <Button title="Save" icon="checkmark" onPress={() => save(f.status)} loading={busy} />
          </>
        ) : (
          <>
            <Button title="Save draft" variant="secondary" onPress={() => save('draft')} loading={busy} />
            <Button title="Submit" icon="paper-plane-outline" onPress={() => save('submitted')} loading={busy} />
          </>
        )
      }
    >
      {!existing && (
        <Pressable onPress={() => setStep('type')}>
          <Row>
            <Ionicons name="swap-horizontal" size={16} color={c.primary} />
            <T color={c.primary} weight="600" size={13}>
              Change document type
            </T>
          </Row>
        </Pressable>
      )}
      <Grid min={240} gap={12}>
        <Select label="Project" value={f.project_id} onChange={set('project_id')} options={projectOpts} />
        <Select label="Contractor / supplier" value={f.contractor_id} onChange={set('contractor_id')} options={[{ value: '', label: 'None' }, ...contractorOpts]} searchable />
      </Grid>
      <Field label="Subject / title" value={f.title} onChangeText={set('title')} placeholder={`e.g. ${t.code === 'MIR' ? 'Rebar 16mm delivery' : t.code === 'RFI' ? 'Clash between duct and beam B12' : 'Slab reinforcement, villa type A'}`} />
      <Grid min={160} gap={12}>
        <Field label="Reference no." value={f.number} onChangeText={set('number')} placeholder={autoNumber} hint={f.number ? undefined : 'Leave empty to auto-number'} />
        <Field label="Revision" value={String(f.revision)} onChangeText={(v) => set('revision')(parseInt(v, 10) || 0)} keyboardType="number-pad" />
        <Select label="Discipline" value={f.discipline} onChange={set('discipline')} options={DISCIPLINES.map((d) => ({ value: d, label: d }))} />
      </Grid>
      <Grid min={160} gap={12}>
        <Field label="Submitted on" value={f.submitted_date} onChangeText={set('submitted_date')} placeholder="YYYY-MM-DD" />
        <Field label="Reply required by" value={f.due_date} onChangeText={set('due_date')} placeholder="YYYY-MM-DD" />
        <Select label="Reviewer / responsible" value={f.assigned_to} onChange={set('assigned_to')} options={[{ value: '', label: 'Unassigned' }, ...userOpts]} searchable />
      </Grid>

      <View style={{ gap: 12, padding: 14, borderRadius: 14, backgroundColor: c.primarySoft }}>
        <T weight="700" color={c.primary}>
          {t.name} details
        </T>
        {t.fields.map((fd) => (
          <Field key={fd.key} label={fd.label} value={f.fields[fd.key] ?? ''} onChangeText={setField(fd.key)} multiline={fd.multiline} placeholder={fd.placeholder} />
        ))}
      </View>
      <Field label="Description / remarks" value={f.description} onChangeText={set('description')} multiline />

      <View style={{ gap: 8 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T weight="700">Attachments</T>
          <Button small title="Add files" icon="attach" variant="secondary" onPress={addFiles} loading={uploading} />
        </Row>
        {f.attachments.map((a, i) => (
          <Row key={i} style={{ padding: 10, borderRadius: 10, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
            <Ionicons name="document-attach-outline" size={18} color={c.primary} />
            <T style={{ flex: 1 }} numberOfLines={1}>
              {a.name}
            </T>
            <T size={12} muted>
              {a.size ? fmtSize(a.size) : ''}
            </T>
            <Pressable onPress={() => setF((x) => ({ ...x, attachments: x.attachments.filter((_, j) => j !== i) }))}>
              <Ionicons name="close" size={18} color={c.textMuted} />
            </Pressable>
          </Row>
        ))}
      </View>
    </Sheet>
  );
}

/* --------------------------------- List --------------------------------- */

export function SubmittalsScreen({ params }: { params?: Record<string, string> }) {
  const { submittals, me, projects, profiles, contractors } = useStore();
  const { projectOpts, contractorOpts, withAll } = useOptions();
  const [type, setType] = useState(params?.type ?? '');
  const [status, setStatus] = useState(params?.status ?? '');
  const [project, setProject] = useState(params?.project ?? '');
  const [contractor, setContractor] = useState('');
  const [mine, setMine] = useState(false);
  const [q, setQ] = useState('');
  const [form, setForm] = useState(false);

  const base = submittals.filter(
    (s) =>
      (!project || s.project_id === project) &&
      (!contractor || s.contractor_id === contractor) &&
      (!mine || s.assigned_to === me.id || s.created_by === me.id) &&
      (!status || (status === 'open' ? ['submitted', 'under_review'].includes(s.status) : s.status === status)) &&
      match(q, docRef(s), s.title, s.description, ...Object.values(s.fields)),
  );
  const list = base.filter((s) => !type || s.type === type).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const usedTypes = SUBMITTAL_TYPES.filter((t) => base.some((s) => s.type === t.code));

  return (
    <Screen
      title="Submittals"
      subtitle="Shop drawings, MIR, WIR, RFI, NCR and every other document, each with a branded PDF."
      actions={
        <>
          <Button title="New submittal" icon="add" onPress={() => setForm(true)} />
          <Button
            title="Excel"
            icon="grid-outline"
            variant="secondary"
            onPress={() => saveXlsx(`Submittal register ${fileStamp()}.xlsx`, [submittalSheet(list, { projects, profiles, contractors })]).then(() => toast('Submittal register saved'), (e) => toast(errorText(e), 'danger'))}
          />
        </>
      }
    >
      <View style={{ gap: 10, marginBottom: 14 }}>
        <Chips
          value={type}
          onChange={setType}
          options={[{ value: '', label: 'All', count: base.length }, ...usedTypes.map((t) => ({ value: t.code, label: t.code, count: base.filter((s) => s.type === t.code).length }))]}
        />
        <Row wrap gap={10}>
          <SearchBar value={q} onChangeText={setQ} placeholder="Search number, title, material, drawing…" style={{ flexGrow: 1, minWidth: 220 }} />
          <Select compact value={project} onChange={setProject} options={withAll(projectOpts, 'All projects')} style={{ minWidth: 170 }} />
          <Select compact value={contractor} onChange={setContractor} options={withAll(contractorOpts, 'All contractors')} style={{ minWidth: 170 }} />
          <Select
            compact
            value={status}
            onChange={setStatus}
            options={[{ value: '', label: 'Any status' }, { value: 'open', label: 'Awaiting reply' }, ...Object.entries(SUBMITTAL_STATUS).map(([value, v]) => ({ value, label: v.label }))]}
            style={{ minWidth: 150 }}
          />
          <Chips value={mine ? 'mine' : 'all'} onChange={(v) => setMine(v === 'mine')} options={[{ value: 'all', label: 'Everyone' }, { value: 'mine', label: 'Mine' }]} />
        </Row>
      </View>
      <Card padded={false}>
        {list.length ? (
          <Paged items={list} render={(s) => <SubmittalRow key={s.id} s={s} />} />
        ) : (
          <Empty icon="document-text-outline" title="No submittals" sub="Create one with the New submittal button." />
        )}
      </Card>
      <SubmittalForm visible={form} onClose={() => setForm(false)} defaults={type ? { type, ...(project ? { project_id: project } : {}) } : project ? { project_id: project } : undefined} />
    </Screen>
  );
}

/* -------------------------------- Detail -------------------------------- */

export function SubmittalDetail({ id }: { id: string }) {
  const { c } = useTheme();
  const nav = useNav();
  const { submittals, projects, contractors, user, update, remove, isManager, me, notify } = useStore();
  const s = submittals.find((x) => x.id === id);
  const [edit, setEdit] = useState(false);
  const [revise, setRevise] = useState(false);
  const [reply, setReply] = useState(s?.reply ?? '');
  const pdf = useSubmittalPdf();
  const t = submittalType(s?.type ?? 'SD');
  const history = useMemo(() => (s ? submittals.filter((x) => x.number === s.number && x.id !== s.id) : []), [submittals, s]);

  if (!s) return <Empty title="Submittal not found" />;
  const p = projects.find((x) => x.id === s.project_id);
  const con = contractors.find((x) => x.id === s.contractor_id);
  const st = SUBMITTAL_STATUS[s.status];
  const canReview = isManager || s.assigned_to === me.id;

  const setStatus = async (status: SubmittalStatus) => {
    await update('submittals', s.id, { status, reply });
    notify(s.created_by, `${docRef(s)} is now ${SUBMITTAL_STATUS[status].label}`, s.title, `submittal:${s.id}`);
    toast(`Marked ${SUBMITTAL_STATUS[status].label}`);
  };

  return (
    <Screen
      title={s.title}
      subtitle={`${t.name} · ${docRef(s)}`}
      actions={
        <>
          <Button title="PDF" icon="document-outline" onPress={() => pdf(s)} />
          <Button title="Edit" icon="create-outline" variant="secondary" onPress={() => setEdit(true)} />
          {['revise_resubmit', 'rejected', 'approved_as_noted'].includes(s.status) && (
            <Button title="New revision" icon="git-branch-outline" variant="secondary" onPress={() => setRevise(true)} />
          )}
          {(isManager || s.created_by === me.id) && (
            <Button
              title="Delete"
              icon="trash-outline"
              variant="ghost"
              onPress={async () => {
                if (await confirm('Delete submittal?', `${docRef(s)} ${s.title}`)) {
                  await remove('submittals', s.id);
                  nav.back();
                }
              }}
            />
          )}
        </>
      }
    >
      <Grid min={340}>
        <Card style={{ gap: 4 }}>
          <Row style={{ justifyContent: 'space-between', marginBottom: 8 }}>
            <Badge label={st.code ? `Code ${st.code} · ${st.label}` : st.label} tone={st.tone} />
            <DueLabel date={s.due_date} done={!['submitted', 'under_review'].includes(s.status)} />
          </Row>
          <KV k="Document type" v={`${t.name} (${t.code})`} />
          <KV k="Project" v={p?.name} />
          <KV k="Contractor" v={con?.name} />
          {!!s.building && <KV k="Building / area" v={s.building} />}
          <KV k="Discipline" v={s.discipline} />
          <KV k="Submitted" v={fmtDate(s.submitted_date)} />
          {s.responded_date ? <KV k="Responded" v={fmtDate(s.responded_date)} /> : <KV k="Reply due" v={fmtDate(s.due_date)} />}
          <KV k="Prepared by" v={user(s.created_by)?.full_name} />
          <KV k="Reviewer" v={user(s.assigned_to)?.full_name ?? s.fields.concerned_engineer} />
          {!!s.fields.tracker_status && <KV k="Tracker status" v={s.fields.tracker_status} />}
          {t.fields
            .filter((f) => s.fields[f.key])
            .map((f) => (
              <KV key={f.key} k={f.label} v={s.fields[f.key]} />
            ))}
          {!!s.description && <KV k="Remarks" v={s.description} />}
        </Card>
        <View style={{ gap: 14 }}>
          <Card style={{ gap: 10 }}>
            <H2>Review</H2>
            {canReview ? (
              <>
                <Field label={s.type === 'RFI' ? 'Response' : 'Comments'} value={reply} onChangeText={setReply} multiline placeholder="Write the consultant / engineer reply" />
                <Row wrap>
                  {s.status === 'draft' && <Button small title="Submit" icon="paper-plane-outline" onPress={() => setStatus('submitted')} />}
                  {s.status === 'submitted' && <Button small variant="secondary" title="Start review" onPress={() => setStatus('under_review')} />}
                  <Button small variant="secondary" title="A · Approve" onPress={() => setStatus('approved')} />
                  <Button small variant="secondary" title="B · As noted" onPress={() => setStatus('approved_as_noted')} />
                  <Button small variant="secondary" title="C · Revise" onPress={() => setStatus('revise_resubmit')} />
                  <Button small variant="secondary" title="D · Reject" onPress={() => setStatus('rejected')} />
                  <Button small variant="ghost" title="Close" onPress={() => setStatus('closed')} />
                </Row>
              </>
            ) : (
              <T muted={!s.reply}>{s.reply || 'No reply yet.'}</T>
            )}
          </Card>
          <Card style={{ gap: 8 }}>
            <H2>Attachments</H2>
            {s.attachments.length ? (
              s.attachments.map((a, i) => (
                <Pressable key={i} onPress={() => openFile(a.url, a.name).catch((e) => toast(errorText(e), 'danger'))}>
                  <Row style={{ padding: 10, borderRadius: 10, backgroundColor: c.surfaceAlt }}>
                    <Ionicons name="document-attach-outline" size={18} color={c.primary} />
                    <T style={{ flex: 1 }} numberOfLines={1}>
                      {a.name}
                    </T>
                    <Ionicons name="open-outline" size={16} color={c.textMuted} />
                  </Row>
                </Pressable>
              ))
            ) : (
              <T muted>No files attached.</T>
            )}
          </Card>
          {history.length > 0 && (
            <Card style={{ gap: 8 }}>
              <H2>Other revisions</H2>
              {history.map((h) => (
                <Pressable key={h.id} onPress={() => nav.push({ name: 'submittal', id: h.id })}>
                  <Row style={{ justifyContent: 'space-between', paddingVertical: 6 }}>
                    <T>Rev {h.revision}</T>
                    <Badge label={SUBMITTAL_STATUS[h.status].label} tone={SUBMITTAL_STATUS[h.status].tone} />
                  </Row>
                </Pressable>
              ))}
            </Card>
          )}
        </View>
      </Grid>
      <SubmittalForm visible={edit} onClose={() => setEdit(false)} existing={s} />
      <SubmittalForm
        visible={revise}
        onClose={() => setRevise(false)}
        defaults={{
          ...withoutIds(s),
          revision: s.revision + 1,
          status: 'draft',
          reply: '',
          submitted_date: today(),
          due_date: ymd(addDays(new Date(), 14)),
          created_by: me.id,
        }}
      />
    </Screen>
  );
}
