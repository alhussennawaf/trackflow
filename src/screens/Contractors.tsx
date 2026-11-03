import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useNav } from '../components/nav';
import { match, useOptions } from '../components/pickers';
import { Grid, Screen } from '../components/Screen';
import { Badge, Button, Card, Chips, confirm, Empty, errorText, Field, H2, KV, Paged, Row, SearchBar, Select, Sheet, T, toast } from '../components/ui';
import { backend } from '../data/backend';
import { CONTRACTOR_FOLDERS, CONTRACTOR_KINDS, submittalType } from '../data/catalog';
import { useStore } from '../data/store';
import type { Contractor, ContractorFolder, DocumentFile } from '../data/types';
import { fmtDate, money } from '../lib/dates';
import { fmtSize, openFile, pickDocuments } from '../lib/files';
import { useTheme } from '../theme/ThemeContext';
import { SubmittalForm, SubmittalRow } from './Submittals';

const FOLDER_TYPES: Partial<Record<ContractorFolder, string>> = { rfis: 'RFI', mirs: 'MIR', submittals: 'SD', invoices: 'PAY', contracts: 'VOR' };

export function ContractorForm({ visible, onClose, contractor }: { visible: boolean; onClose: () => void; contractor?: Contractor }) {
  const { insert, update, projects } = useStore();
  const blank: Omit<Contractor, 'id' | 'created_at'> = {
    name: '',
    trade: '',
    kind: 'subcontractor',
    contact_person: '',
    phone: '',
    email: '',
    cr_number: '',
    vat_number: '',
    project_ids: [],
  };
  const [f, setF] = useState(contractor ?? blank);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (visible) setF(contractor ?? blank);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, contractor]);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const save = async () => {
    if (!f.name.trim()) return toast('Company name is required', 'warning');
    setBusy(true);
    try {
      if (contractor) await update('contractors', contractor.id, f);
      else await insert('contractors', f);
      toast('Saved');
      onClose();
    } catch (e) {
      toast(errorText(e), 'danger');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={contractor ? 'Edit contractor' : 'New contractor / supplier'}
      footer={
        <>
          <Button title="Cancel" variant="ghost" onPress={onClose} />
          <Button title="Save" icon="checkmark" onPress={save} loading={busy} />
        </>
      }
    >
      <Field label="Company name" value={f.name} onChangeText={set('name')} />
      <Grid min={180} gap={12}>
        <Select label="Type" value={f.kind} onChange={set('kind')} options={Object.entries(CONTRACTOR_KINDS).map(([value, label]) => ({ value, label }))} />
        <Field label="Trade / scope" value={f.trade} onChangeText={set('trade')} placeholder="e.g. MEP, Concrete" />
      </Grid>
      <Grid min={180} gap={12}>
        <Field label="Contact person" value={f.contact_person} onChangeText={set('contact_person')} />
        <Field label="Phone" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
      </Grid>
      <Field label="Email" value={f.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" />
      <Grid min={180} gap={12}>
        <Field label="CR number" value={f.cr_number} onChangeText={set('cr_number')} />
        <Field label="VAT number" value={f.vat_number} onChangeText={set('vat_number')} />
      </Grid>
      <T weight="700">Projects</T>
      <Row wrap>
        {projects.map((p) => {
          const on = f.project_ids.includes(p.id);
          return (
            <Button
              key={p.id}
              small
              title={p.name}
              variant={on ? 'primary' : 'secondary'}
              icon={on ? 'checkmark' : 'add'}
              onPress={() => setF((x) => ({ ...x, project_ids: on ? x.project_ids.filter((i) => i !== p.id) : [...x.project_ids, p.id] }))}
            />
          );
        })}
      </Row>
    </Sheet>
  );
}

export function ContractorsScreen() {
  const { c } = useTheme();
  const nav = useNav();
  const { contractors, documents, submittals, isManager } = useStore();
  const { projectOpts, withAll } = useOptions();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('');
  const [project, setProject] = useState('');
  const [form, setForm] = useState(false);
  const list = contractors.filter((x) => (!kind || x.kind === kind) && (!project || x.project_ids.includes(project)) && match(q, x.name, x.trade, x.contact_person, x.email, x.cr_number));
  return (
    <Screen
      title="Contractors"
      subtitle="Each company has its own folders: documents, contracts, submittals, RFIs, MIRs and invoices."
      actions={isManager && <Button title="Add contractor" icon="add" onPress={() => setForm(true)} />}
    >
      <Row wrap gap={10} style={{ marginBottom: 14 }}>
        <SearchBar value={q} onChangeText={setQ} placeholder="Search companies, contacts, CR no…" style={{ flexGrow: 1, minWidth: 220 }} />
        <Select compact value={project} onChange={setProject} options={withAll(projectOpts, 'All projects')} style={{ minWidth: 170 }} />
        <Select compact value={kind} onChange={setKind} options={[{ value: '', label: 'All types' }, ...Object.entries(CONTRACTOR_KINDS).map(([value, label]) => ({ value, label }))]} style={{ minWidth: 150 }} />
      </Row>
      {list.length ? (
        <Grid min={300}>
          {list.map((x) => {
            const files = documents.filter((d) => d.contractor_id === x.id).length + submittals.filter((s) => s.contractor_id === x.id).length;
            return (
              <Card key={x.id} onPress={() => nav.push({ name: 'contractor', id: x.id })} style={{ gap: 10 }}>
                <Row gap={12}>
                  <View style={{ width: 52, height: 44, borderRadius: 10, backgroundColor: c.accent + '22', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="folder" size={30} color={c.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <T weight="800" numberOfLines={1}>
                      {x.name}
                    </T>
                    <T size={12} muted numberOfLines={1}>
                      {x.trade}
                    </T>
                  </View>
                </Row>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Badge label={CONTRACTOR_KINDS[x.kind]} tone="primary" />
                  <T size={12} muted>
                    {files} items · {x.project_ids.length} project{x.project_ids.length === 1 ? '' : 's'}
                  </T>
                </Row>
              </Card>
            );
          })}
        </Grid>
      ) : (
        <Empty icon="people-circle-outline" title="No contractors" />
      )}
      <ContractorForm visible={form} onClose={() => setForm(false)} />
    </Screen>
  );
}

function UploadSheet({ visible, onClose, contractor, folder, projectId }: { visible: boolean; onClose: () => void; contractor: Contractor; folder: ContractorFolder; projectId: string }) {
  const { insert, me } = useStore();
  const { projectOpts } = useOptions();
  const [project, setProject] = useState(projectId || contractor.project_ids[0] || '');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState<DocumentFile['invoice_status']>('pending');
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const isInvoice = folder === 'invoices';

  const pick = async () => {
    try {
      const files = await pickDocuments();
      if (!files.length) return;
      setBusy(true);
      for (const file of files) {
        const url = await backend.upload(`contractors/${contractor.id}/${folder}`, file.name, file.dataUri);
        await insert('documents', {
          contractor_id: contractor.id,
          project_id: project,
          folder,
          name: files.length === 1 && name ? name : file.name,
          url,
          mime: file.mime,
          size: file.size,
          amount: isInvoice ? parseFloat(amount) || 0 : 0,
          invoice_status: isInvoice ? status : '',
          notes,
          uploaded_by: me.id,
        });
      }
      toast(`${files.length} file${files.length > 1 ? 's' : ''} uploaded`);
      setName('');
      setAmount('');
      setNotes('');
      onClose();
    } catch (e) {
      toast(errorText(e), 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={`Upload to ${CONTRACTOR_FOLDERS.find((f) => f.key === folder)?.label}`} footer={<Button title="Choose files" icon="cloud-upload-outline" onPress={pick} loading={busy} />}>
      <Select label="Project" value={project} onChange={setProject} options={[{ value: '', label: 'General (no project)' }, ...projectOpts]} />
      <Field label={isInvoice ? 'Invoice no. / title' : 'Title (optional)'} value={name} onChangeText={setName} placeholder="Uses the file name when empty" />
      {isInvoice && (
        <Grid min={160} gap={12}>
          <Field label="Amount (SAR)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
          <Select
            label="Status"
            value={status}
            onChange={(v) => setStatus(v as DocumentFile['invoice_status'])}
            options={[
              { value: 'pending', label: 'Pending' },
              { value: 'approved', label: 'Approved' },
              { value: 'paid', label: 'Paid' },
            ]}
          />
        </Grid>
      )}
      <Field label="Notes" value={notes} onChangeText={setNotes} multiline />
    </Sheet>
  );
}

export function ContractorDetail({ id }: { id: string }) {
  const { c } = useTheme();
  const nav = useNav();
  const { contractors, documents, submittals, projects, isManager, remove, update, user } = useStore();
  const x = contractors.find((k) => k.id === id);
  const [folder, setFolder] = useState<ContractorFolder | null>(null);
  const [project, setProject] = useState('');
  const [upload, setUpload] = useState(false);
  const [edit, setEdit] = useState(false);
  const [newSub, setNewSub] = useState(false);
  if (!x) return <Empty title="Contractor not found" />;

  const docs = documents.filter((d) => d.contractor_id === id && (!project || d.project_id === project));
  const subs = submittals.filter((s) => s.contractor_id === id && (!project || s.project_id === project));
  const inFolder = (f: ContractorFolder) => ({
    files: docs.filter((d) => d.folder === f),
    subs: subs.filter((s) => submittalType(s.type).folder === f),
  });
  const projectOpts = projects.filter((p) => x.project_ids.includes(p.id)).map((p) => ({ value: p.id, label: p.name }));

  const current = folder ? inFolder(folder) : null;
  const folderDef = CONTRACTOR_FOLDERS.find((f) => f.key === folder);
  const invoiceTotals = folder === 'invoices' && current
    ? current.files.reduce(
        (a, d) => ({ ...a, total: a.total + d.amount, paid: a.paid + (d.invoice_status === 'paid' ? d.amount : 0) }),
        { total: 0, paid: 0 },
      )
    : null;

  return (
    <Screen
      title={folder ? `${x.name} / ${folderDef?.label}` : x.name}
      subtitle={`${CONTRACTOR_KINDS[x.kind]} · ${x.trade}`}
      actions={
        <>
          {folder && <Button title="All folders" icon="arrow-back" variant="secondary" onPress={() => setFolder(null)} />}
          {folder && <Button title="Upload" icon="cloud-upload-outline" onPress={() => setUpload(true)} />}
          {folder && FOLDER_TYPES[folder] && <Button title={`New ${FOLDER_TYPES[folder]}`} icon="add" variant="secondary" onPress={() => setNewSub(true)} />}
          {!folder && isManager && <Button title="Edit" icon="create-outline" variant="secondary" onPress={() => setEdit(true)} />}
          {!folder && isManager && (
            <Button
              title="Delete"
              icon="trash-outline"
              variant="ghost"
              onPress={async () => {
                if (await confirm('Delete contractor?', x.name)) {
                  await remove('contractors', x.id);
                  nav.back();
                }
              }}
            />
          )}
        </>
      }
    >
      <Select compact value={project} onChange={setProject} options={[{ value: '', label: 'All projects' }, ...projectOpts]} style={{ maxWidth: 280, marginBottom: 14 }} />
      {!folder ? (
        <Grid min={320}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {CONTRACTOR_FOLDERS.map((f) => {
              const n = inFolder(f.key);
              const count = n.files.length + n.subs.length;
              return (
                <Pressable
                  key={f.key}
                  onPress={() => setFolder(f.key)}
                  style={({ pressed }) => ({
                    width: 150,
                    padding: 14,
                    borderRadius: 16,
                    backgroundColor: pressed ? c.primarySoft : c.surface,
                    borderWidth: 1,
                    borderColor: c.border,
                    gap: 6,
                  })}
                >
                  <View>
                    <Ionicons name="folder" size={44} color={c.accent} />
                    <View style={{ position: 'absolute', left: 13, top: 15 }}>
                      <Ionicons name={f.icon as 'folder'} size={18} color="#fff" />
                    </View>
                  </View>
                  <T weight="700" size={13}>
                    {f.label}
                  </T>
                  <T size={12} muted>
                    {count} item{count === 1 ? '' : 's'}
                  </T>
                </Pressable>
              );
            })}
          </View>
          <Card style={{ gap: 2 }}>
            <H2 style={{ marginBottom: 6 }}>Company details</H2>
            <KV k="Contact" v={x.contact_person} />
            <KV k="Phone" v={x.phone} />
            <KV k="Email" v={x.email} />
            <KV k="CR number" v={x.cr_number} />
            <KV k="VAT number" v={x.vat_number} />
            <KV k="Projects" v={projects.filter((p) => x.project_ids.includes(p.id)).map((p) => p.name).join(', ')} />
          </Card>
        </Grid>
      ) : (
        <View style={{ gap: 14 }}>
          {invoiceTotals && (
            <Grid min={180} gap={10}>
              <Card>
                <T muted size={12}>
                  Invoiced
                </T>
                <T weight="800" size={18}>
                  {money(invoiceTotals.total)}
                </T>
              </Card>
              <Card>
                <T muted size={12}>
                  Paid
                </T>
                <T weight="800" size={18} color={c.success}>
                  {money(invoiceTotals.paid)}
                </T>
              </Card>
              <Card>
                <T muted size={12}>
                  Outstanding
                </T>
                <T weight="800" size={18} color={c.warning}>
                  {money(invoiceTotals.total - invoiceTotals.paid)}
                </T>
              </Card>
            </Grid>
          )}
          {current && current.subs.length > 0 && (
            <Card padded={false}>
              <T weight="700" style={{ padding: 14, paddingBottom: 4 }}>
                Documents raised in the app
              </T>
              <Paged items={current.subs} render={(s) => <SubmittalRow key={s.id} s={s} />} />
            </Card>
          )}
          <Card padded={false}>
            <T weight="700" style={{ padding: 14, paddingBottom: 4 }}>
              Uploaded files
            </T>
            {current && current.files.length ? (
              current.files.map((d) => (
                <Row key={d.id} style={{ padding: 14, borderTopWidth: 1, borderColor: c.border }} gap={12}>
                  <Ionicons name={d.mime.startsWith('image') ? 'image-outline' : 'document-outline'} size={24} color={c.primary} />
                  <Pressable style={{ flex: 1 }} onPress={() => openFile(d.url, d.name).catch((e) => toast(errorText(e), 'warning'))}>
                    <T weight="600" numberOfLines={1}>
                      {d.name}
                    </T>
                    <T size={12} muted numberOfLines={1}>
                      {fmtDate(d.created_at)} · {user(d.uploaded_by)?.full_name ?? ''} {d.size ? `· ${fmtSize(d.size)}` : ''}
                      {d.project_id ? ` · ${projects.find((p) => p.id === d.project_id)?.code ?? ''}` : ''}
                    </T>
                  </Pressable>
                  {folder === 'invoices' && (
                    <>
                      <T weight="700">{money(d.amount)}</T>
                      <Pressable
                        onPress={() => {
                          const order: DocumentFile['invoice_status'][] = ['pending', 'approved', 'paid'];
                          const next = order[(order.indexOf(d.invoice_status) + 1) % order.length];
                          update('documents', d.id, { invoice_status: next });
                        }}
                      >
                        <Badge label={d.invoice_status || 'pending'} tone={d.invoice_status === 'paid' ? 'success' : d.invoice_status === 'approved' ? 'info' : 'warning'} />
                      </Pressable>
                    </>
                  )}
                  {isManager && (
                    <Pressable
                      onPress={async () => {
                        if (await confirm('Delete file?', d.name)) remove('documents', d.id);
                      }}
                    >
                      <Ionicons name="trash-outline" size={18} color={c.textMuted} />
                    </Pressable>
                  )}
                </Row>
              ))
            ) : (
              <Empty icon="cloud-upload-outline" title="Folder is empty" sub="Upload PDFs, images or any file." />
            )}
          </Card>
        </View>
      )}
      {folder && <UploadSheet visible={upload} onClose={() => setUpload(false)} contractor={x} folder={folder} projectId={project} />}
      <ContractorForm visible={edit} onClose={() => setEdit(false)} contractor={x} />
      {folder && FOLDER_TYPES[folder] && (
        <SubmittalForm visible={newSub} onClose={() => setNewSub(false)} defaults={{ type: FOLDER_TYPES[folder], contractor_id: x.id, project_id: project || x.project_ids[0] || '' }} />
      )}
    </Screen>
  );
}

