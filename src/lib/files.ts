import * as DocumentPicker from 'expo-document-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Linking, Platform } from 'react-native';
import { inAndroidShell, shell } from './native';

export type PickedFile = { name: string; dataUri: string; mime: string; size: number };

const MAX_BYTES = 15 * 1024 * 1024;

async function shrink(uri: string): Promise<string> {
  const r = await manipulateAsync(uri, [{ resize: { width: 1600 } }], { compress: 0.6, format: SaveFormat.JPEG, base64: true });
  return `data:image/jpeg;base64,${r.base64}`;
}

export async function pickImages(fromCamera: boolean): Promise<string[]> {
  if (fromCamera) {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('Camera permission is needed to take photos');
  }
  const opts: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 0.8,
    allowsMultipleSelection: !fromCamera,
    selectionLimit: 20,
  };
  const res = fromCamera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled) return [];
  const out: string[] = [];
  for (const a of res.assets) out.push(await shrink(a.uri));
  return out;
}

export async function pickDocuments(): Promise<PickedFile[]> {
  const res = await DocumentPicker.getDocumentAsync({ multiple: true, base64: true, copyToCacheDirectory: true });
  if (res.canceled) return [];
  const files: PickedFile[] = [];
  for (const a of res.assets) {
    if ((a.size ?? 0) > MAX_BYTES) throw new Error(`${a.name} is larger than 15 MB`);
    const mime = a.mimeType ?? 'application/octet-stream';
    let dataUri = a.uri;
    if (!dataUri.startsWith('data:')) {
      if (!a.base64) throw new Error(`Could not read ${a.name}`);
      dataUri = `data:${mime};base64,${a.base64}`;
    }
    files.push({ name: a.name, dataUri, mime, size: a.size ?? 0 });
  }
  return files;
}

// Opens an uploaded file. Browsers refuse to open data: URLs directly, so convert to a blob.
export async function openFile(url: string, name?: string) {
  if (!url) throw new Error('This record has no file attached (demo data).');
  if (inAndroidShell) {
    if (url.startsWith('data:')) shell!.openDataUrl(name ?? 'file', url);
    else shell!.openExternal(url);
    return;
  }
  if (Platform.OS === 'web' && url.startsWith('data:')) {
    const blob = await (await fetch(url)).blob();
    window.open(URL.createObjectURL(blob), '_blank');
    return;
  }
  await Linking.openURL(url);
}

export const fmtSize = (n: number) =>
  n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : n > 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`;
