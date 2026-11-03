import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Image, Modal, Platform, Pressable, View, useWindowDimensions } from 'react-native';
import { match, useOptions } from '../components/pickers';
import { Screen } from '../components/Screen';
import { Button, Chips, confirm, Empty, errorText, Field, IconButton, Row, SearchBar, Select, Sheet, T, toast } from '../components/ui';
import { backend } from '../data/backend';
import { PHOTO_CATEGORIES, PHOTO_SCOPES, PHOTO_SECTIONS } from '../data/catalog';
import { useStore } from '../data/store';
import type { Photo } from '../data/types';
import { fmtDate } from '../lib/dates';
import { pickImages } from '../lib/files';
import { inAndroidShell } from '../lib/native';
import { useTheme } from '../theme/ThemeContext';

type GroupBy = 'scope' | 'section' | 'category' | 'all';
const GROUPS: Record<Exclude<GroupBy, 'all'>, { label: string; values: string[]; icon: 'construct-outline' | 'business-outline' | 'pricetags-outline' }> = {
  scope: { label: 'Scope of work', values: PHOTO_SCOPES, icon: 'construct-outline' },
  section: { label: 'Building section', values: PHOTO_SECTIONS, icon: 'business-outline' },
  category: { label: 'Category', values: PHOTO_CATEGORIES, icon: 'pricetags-outline' },
};

function UploadSheet({ visible, onClose, projectId, preset }: { visible: boolean; onClose: () => void; projectId: string; preset: Partial<Photo> }) {
  const { insert, me, photos } = useStore();
  const [scope, setScope] = useState(preset.scope ?? PHOTO_SCOPES[0]);
  const [section, setSection] = useState(preset.section ?? PHOTO_SECTIONS[0]);
  const [category, setCategory] = useState(preset.category ?? PHOTO_CATEGORIES[0]);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  React.useEffect(() => {
    if (!visible) return;
    if (preset.scope) setScope(preset.scope);
    if (preset.section) setSection(preset.section);
    if (preset.category) setCategory(preset.category);
  }, [visible, preset.scope, preset.section, preset.category]);

  const extra = (k: 'scope' | 'section' | 'category', base: string[]) =>
    Array.from(new Set([...base, ...photos.filter((p) => p.project_id === projectId).map((p) => p[k])])).map((v) => ({ value: v, label: v }));

  const go = async (camera: boolean) => {
    try {
      const imgs = await pickImages(camera);
      if (!imgs.length) return;
      setBusy(true);
      for (const [i, dataUri] of imgs.entries()) {
        const url = await backend.upload(`photos/${projectId}`, `photo_${Date.now()}_${i}.jpg`, dataUri);
        await insert('photos', {
          project_id: projectId,
          url,
          caption,
          scope,
          section,
          category,
          taken_at: new Date().toISOString(),
          uploaded_by: me.id,
        });
      }
      toast(`${imgs.length} photo${imgs.length > 1 ? 's' : ''} added`);
      setCaption('');
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
      title="Add site photos"
      footer={
        <>
          {(Platform.OS !== 'web' || inAndroidShell) && <Button title="Camera" icon="camera-outline" variant="secondary" onPress={() => go(true)} loading={busy} />}
          <Button title={Platform.OS === 'web' && !inAndroidShell ? 'Choose photos' : 'Gallery'} icon="images-outline" onPress={() => go(false)} loading={busy} />
        </>
      }
    >
      <Select label="Scope of work" value={scope} onChange={setScope} options={extra('scope', PHOTO_SCOPES)} />
      <Select label="Building section" value={section} onChange={setSection} options={extra('section', PHOTO_SECTIONS)} />
      <Select label="Category" value={category} onChange={setCategory} options={extra('category', PHOTO_CATEGORIES)} />
      <Field label="Caption" value={caption} onChangeText={setCaption} placeholder="e.g. Slab rebar ready for inspection" />
    </Sheet>
  );
}

function Viewer({ list, index, onClose, onIndex }: { list: Photo[]; index: number; onClose: () => void; onIndex: (i: number) => void }) {
  const { user, remove, isManager, me, projects } = useStore();
  const { width, height } = useWindowDimensions();
  const p = list[index];
  if (!p) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.94)' }}>
        <Row style={{ padding: 12, paddingTop: Platform.OS === 'web' ? 12 : 40, justifyContent: 'space-between' }}>
          <T color="#fff" weight="600">
            {index + 1} / {list.length}
          </T>
          <Row>
            {(isManager || p.uploaded_by === me.id) && (
              <IconButton
                icon="trash-outline"
                color="#fff"
                onPress={async () => {
                  if (await confirm('Delete photo?', p.caption || 'This photo')) {
                    await remove('photos', p.id);
                    onClose();
                  }
                }}
              />
            )}
            <IconButton icon="close" color="#fff" size={28} onPress={onClose} />
          </Row>
        </Row>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Image source={{ uri: p.url }} style={{ width: width, height: height * 0.68 }} resizeMode="contain" />
          {index > 0 && <IconButton icon="chevron-back-circle" size={44} color="#fff" style={{ position: 'absolute', left: 8 }} onPress={() => onIndex(index - 1)} />}
          {index < list.length - 1 && <IconButton icon="chevron-forward-circle" size={44} color="#fff" style={{ position: 'absolute', right: 8 }} onPress={() => onIndex(index + 1)} />}
        </View>
        <View style={{ padding: 20, gap: 4 }}>
          <T color="#fff" weight="700" size={16}>
            {p.caption || 'Untitled'}
          </T>
          <T color="#bbb" size={13}>
            {projects.find((x) => x.id === p.project_id)?.name} · {p.scope} · {p.section} · {p.category}
          </T>
          <T color="#888" size={12}>
            {fmtDate(p.taken_at)} · by {user(p.uploaded_by)?.full_name ?? '—'}
          </T>
        </View>
      </View>
    </Modal>
  );
}

export function GalleryScreen({ params }: { params?: Record<string, string> }) {
  const { c } = useTheme();
  const { photos, projects } = useStore();
  const { projectOpts } = useOptions();
  const { width } = useWindowDimensions();
  const [chosen, setProject] = useState(params?.project ?? '');
  const project = chosen || projects[0]?.id || '';
  const [group, setGroup] = useState<GroupBy>('scope');
  const [folder, setFolder] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [viewer, setViewer] = useState<{ list: Photo[]; i: number } | null>(null);
  const [upload, setUpload] = useState(false);

  const pp = useMemo(() => photos.filter((p) => p.project_id === project).sort((a, b) => b.taken_at.localeCompare(a.taken_at)), [photos, project]);
  const searching = q.trim().length > 0;

  const folders = useMemo(() => {
    if (group === 'all') return [];
    const vals = Array.from(new Set([...GROUPS[group].values, ...pp.map((p) => p[group])]));
    return vals.map((v) => ({ name: v, photos: pp.filter((p) => p[group] === v) }));
  }, [group, pp]);

  const shown = searching
    ? pp.filter((p) => match(q, p.caption, p.scope, p.section, p.category))
    : group === 'all'
      ? pp
      : folder
        ? pp.filter((p) => p[group as Exclude<GroupBy, 'all'>] === folder)
        : [];

  const tile = Math.max(140, Math.min(220, (Math.min(width, 1400) - (width >= 900 ? 300 : 40)) / (width >= 900 ? 5 : 2) - 12));
  const preset: Partial<Photo> = folder && group !== 'all' ? { [group]: folder } : {};

  return (
    <Screen
      title={folder ? folder : 'Photo gallery'}
      subtitle={folder && group !== 'all' ? `${projects.find((p) => p.id === project)?.name} · ${GROUPS[group].label}` : 'Site photos per project, filed by scope, building section and category.'}
      actions={
        <>
          {folder && <Button title="All folders" icon="arrow-back" variant="secondary" onPress={() => setFolder(null)} />}
          <Button title="Add photos" icon="camera-outline" onPress={() => setUpload(true)} disabled={!project} />
        </>
      }
    >
      <View style={{ gap: 10, marginBottom: 14 }}>
        <Row wrap gap={10}>
          <Select
            compact
            value={project}
            onChange={(v) => {
              setProject(v);
              setFolder(null);
            }}
            options={projectOpts}
            style={{ minWidth: 220 }}
          />
          <SearchBar value={q} onChangeText={setQ} placeholder="Search captions and folders…" style={{ flexGrow: 1, minWidth: 220 }} />
        </Row>
        {!folder && !searching && (
          <Chips
            value={group}
            onChange={setGroup}
            options={[
              { value: 'scope', label: 'Scope of work' },
              { value: 'section', label: 'Building section' },
              { value: 'category', label: 'Category' },
              { value: 'all', label: 'All photos', count: pp.length },
            ]}
          />
        )}
      </View>

      {!searching && !folder && group !== 'all' ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {folders.map((f) => (
            <Pressable key={f.name} onPress={() => setFolder(f.name)} style={({ pressed }) => ({ width: tile, opacity: pressed ? 0.85 : 1 })}>
              <View style={{ width: tile, height: tile * 0.72, borderRadius: 14, overflow: 'hidden', backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border }}>
                {f.photos[0] ? (
                  <Image source={{ uri: f.photos[0].url }} style={{ width: '100%', height: '100%' }} />
                ) : (
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="folder-open-outline" size={36} color={c.textMuted} />
                  </View>
                )}
                <View style={{ position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                  <Ionicons name="images" size={12} color="#fff" />
                  <T size={11} color="#fff" weight="700">
                    {f.photos.length}
                  </T>
                </View>
              </View>
              <Row style={{ marginTop: 6 }} gap={6}>
                <Ionicons name={GROUPS[group as Exclude<GroupBy, 'all'>].icon} size={14} color={c.primary} />
                <T weight="600" size={13} numberOfLines={1} style={{ flex: 1 }}>
                  {f.name}
                </T>
              </Row>
            </Pressable>
          ))}
        </View>
      ) : shown.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {shown.map((p, i) => (
            <Pressable key={p.id} onPress={() => setViewer({ list: shown, i })}>
              <Image source={{ uri: p.url }} style={{ width: tile, height: tile * 0.72, borderRadius: 12 }} />
              <T size={12} numberOfLines={1} style={{ width: tile, marginTop: 4 }}>
                {p.caption || p.category}
              </T>
              <T size={11} muted>
                {fmtDate(p.taken_at)}
              </T>
            </Pressable>
          ))}
        </View>
      ) : (
        <Empty icon="images-outline" title="No photos here yet" sub="Use Add photos to upload from the camera or gallery." />
      )}

      {viewer && <Viewer list={viewer.list} index={viewer.i} onIndex={(i) => setViewer({ ...viewer, i })} onClose={() => setViewer(null)} />}
      <UploadSheet visible={upload} onClose={() => setUpload(false)} projectId={project} preset={preset} />
    </Screen>
  );
}
