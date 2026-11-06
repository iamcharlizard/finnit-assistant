import * as React from 'react';
import { ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTranslations } from 'use-intl';
import { Camera, Image as ImageIcon, ScanLine } from 'lucide-react-native';

import { TwView } from '@finnit/ui-native/lib/tw';
import { useToken } from '@finnit/ui-native/theme/theme-root';
import { Button } from '@finnit/ui-native/components/ui/button';
import { Icon } from '@finnit/ui-native/components/ui/icon';
import { Text } from '@finnit/ui-native/components/ui/text';

import type { LocalFile } from '@/lib/files/upload';
import type { ReceiptReaderState } from '@/lib/receipts/use-receipt-reader';

/** The photo as the upload takes it (compressed by the picker). */
function toFile(asset: ImagePicker.ImagePickerAsset): LocalFile {
  const mimeType = asset.mimeType ?? 'image/jpeg';
  return { uri: asset.uri, name: asset.fileName ?? `receipt.${mimeType.split('/')[1] ?? 'jpg'}`, mimeType };
}

/**
 * "Escanear ticket": a photo with the camera or from the library, then
 * uploading and reading it (the web's ReceiptCapture / ReceiptReading).
 */
export function ReceiptCapture({
  state,
  onPick,
  onCancel,
  onManual,
}: {
  state: ReceiptReaderState;
  onPick: (file: LocalFile) => void;
  onCancel: () => void;
  /** Read failed: type it by hand. */
  onManual: () => void;
}) {
  const t = useTranslations('receipts');
  const tint = useToken('--brand-ink');

  async function pick(source: 'camera' | 'library') {
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7, exif: false };
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return;
    }
    const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (!result.canceled && result.assets[0]) onPick(toFile(result.assets[0]));
  }

  if (state.phase === 'uploading' || state.phase === 'reading') {
    return (
      <TwView className="items-center gap-3 py-8">
        <ActivityIndicator color={tint} />
        <Text weight="medium" className="text-base">
          {state.phase === 'uploading' ? t('uploading') : t('reading')}
        </Text>
        {state.phase === 'reading' ? <Text className="text-center text-sm text-on-surface-variant">{t('readingHint')}</Text> : null}
        <Button variant="ghost" label={t('cancel')} onPress={onCancel} />
      </TwView>
    );
  }

  return (
    <TwView className="gap-4">
      <TwView className="items-center gap-2 rounded-card border border-dashed border-outline px-6 py-8">
        <Icon icon={ScanLine} size={36} color="--brand-ink" />
        <Text weight="medium" className="text-center text-base">
          {t('picker.title')}
        </Text>
        <Text className="text-center text-xs text-on-surface-variant">{t('picker.tips')}</Text>
      </TwView>
      {state.phase === 'failed' ? (
        <TwView className="gap-2">
          <Text accessibilityRole="alert" className="text-sm text-expense">
            {state.reason.startsWith('upload') ? t(`errors.${state.reason as 'uploadFailed'}`) : t(`failed.${state.reason as 'readFailed'}`)}
          </Text>
          {state.reason === 'readFailed' || state.reason === 'timeout' ? <Button variant="outline" label={t('actions.manual')} onPress={onManual} /> : null}
        </TwView>
      ) : null}
      <Button icon={Camera} label={t('capture')} onPress={() => void pick('camera')} className="w-full" />
      <Button variant="outline" icon={ImageIcon} label={t('picker.hint')} onPress={() => void pick('library')} className="w-full" />
    </TwView>
  );
}
