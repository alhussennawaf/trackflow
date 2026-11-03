import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { inAndroidShell, shell } from './native';

function toBase64(bytes: Uint8Array) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

// Saves a generated file: Downloads folder in the Android app, a browser download on web, the share sheet in the Expo build.
export async function saveFile(name: string, data: Uint8Array | string, mime: string) {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  if (inAndroidShell) {
    if (!shell!.saveFile(name, toBase64(bytes), mime)) throw new Error('Could not save the file');
    return;
  }
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return;
  }
  const f = new File(Paths.cache, name);
  if (f.exists) f.delete();
  f.create();
  f.write(bytes);
  await Sharing.shareAsync(f.uri, { mimeType: mime, dialogTitle: name });
}

// Lets the user pick a file and returns its text (used for restoring a backup).
export async function pickTextFile(accept: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return resolve(null);
        file.text().then(resolve, () => resolve(null));
      };
      input.click();
    });
  }
  const DocumentPicker = await import('expo-document-picker');
  const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
  if (res.canceled) return null;
  return new File(res.assets[0].uri).text();
}

// Lets the user pick a binary file (e.g. .xlsx) and returns its bytes.
export async function pickBinaryFile(accept: string): Promise<{ name: string; bytes: Uint8Array } | null> {
  if (Platform.OS === 'web') {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return resolve(null);
        file.arrayBuffer().then((b) => resolve({ name: file.name, bytes: new Uint8Array(b) }), () => resolve(null));
      };
      input.click();
    });
  }
  const DocumentPicker = await import('expo-document-picker');
  const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
  if (res.canceled) return null;
  return { name: res.assets[0].name, bytes: await new File(res.assets[0].uri).bytes() };
}
