// Bridge to the Android shell (android-shell/). When the web build runs inside
// the JAK Projects APK, window.JakNative exposes phone features to the page.

type JakNative = {
  version(): string;
  biometricAvailable(): boolean;
  authenticate(id: string): void;
  printHtml(html: string, title: string): void;
  saveFile(name: string, base64: string, mime: string): boolean;
  openDataUrl(name: string, dataUrl: string): boolean;
  openExternal(url: string): void;
};

type W = { JakNative?: JakNative; __jakBio?: (id: string, ok: boolean) => void; __jakBack?: () => boolean };

const w = (typeof window !== 'undefined' ? window : {}) as unknown as W;

export const shell: JakNative | undefined = w.JakNative;
export const inAndroidShell = !!shell;

const pending = new Map<string, (ok: boolean) => void>();
w.__jakBio = (id, ok) => {
  pending.get(id)?.(ok);
  pending.delete(id);
};

export function shellAuthenticate(): Promise<boolean> {
  return new Promise((resolve) => {
    const id = String(Date.now() + Math.random());
    pending.set(id, resolve);
    shell!.authenticate(id);
  });
}

export function setBackHandler(fn: (() => boolean) | null) {
  w.__jakBack = fn ?? undefined;
}

export function utf8ToBase64(s: string) {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}
