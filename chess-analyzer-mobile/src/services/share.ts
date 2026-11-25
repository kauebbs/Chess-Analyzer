import { Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';

export async function copyText(text: string): Promise<void> {
  await Clipboard.setStringAsync(text);
}

/**
 * Tira um "print" de uma view e entrega ao usuário:
 *  - Android/iOS: abre a folha de compartilhamento (salvar na galeria, WhatsApp, etc.)
 *  - Web: baixa o arquivo PNG.
 */
export async function saveViewAsImage(view: any, fileName: string): Promise<'shared' | 'downloaded'> {
  if (Platform.OS === 'web') {
    const dataUri = await captureRef(view, { format: 'png', quality: 1, result: 'data-uri' });
    const a = document.createElement('a');
    a.href = dataUri;
    a.download = `${fileName}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return 'downloaded';
  }

  const uri = await captureRef(view, { format: 'png', quality: 1, result: 'tmpfile', fileName });
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('O compartilhamento não está disponível neste aparelho.');
  }
  await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Salvar relatório', UTI: 'public.png' });
  return 'shared';
}
