import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { inAndroidShell, shell } from '../lib/native';

// On web: open the browser print dialog (user picks "Save as PDF").
// On Android: render a real PDF file and open the share sheet (WhatsApp, email, Drive…).
export async function exportPdf(html: string, title: string) {
  if (inAndroidShell) {
    shell!.printHtml(html.replace('<title></title>', `<title>${title}</title>`), title);
    return;
  }
  if (Platform.OS === 'web') {
    const iframe = document.createElement('iframe');
    Object.assign(iframe.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow!.document;
    doc.open();
    doc.write(html.replace('<title></title>', `<title>${title}</title>`));
    doc.close();
    const prevTitle = document.title;
    document.title = title; // Chrome uses the parent title as the default file name
    setTimeout(() => {
      iframe.contentWindow!.focus();
      iframe.contentWindow!.print();
      setTimeout(() => {
        document.title = prevTitle;
        iframe.remove();
      }, 1000);
    }, 400);
    return;
  }
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: title, UTI: 'com.adobe.pdf' });
  } else {
    await Print.printAsync({ uri });
  }
}

export { esc } from './esc';
