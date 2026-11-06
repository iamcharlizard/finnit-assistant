import * as React from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { useTranslations } from 'use-intl';
import { FileText, Upload } from 'lucide-react-native';

import { TwView } from '@finnit/ui-native/lib/tw';
import { Button } from '@finnit/ui-native/components/ui/button';
import { Card } from '@finnit/ui-native/components/ui/card';
import { Select } from '@finnit/ui-native/components/ui/select';
import { Text } from '@finnit/ui-native/components/ui/text';

import { UploadError, uploadFile, type LocalFile } from '@/lib/files/upload';

/** "Subir estado de cuenta": the card and the PDF, uploaded straight to the API. */
export function StatementUpload({
  cards,
  initialAccountId,
  onUploaded,
}: {
  cards: { value: string; label: string }[];
  initialAccountId?: string;
  onUploaded: (id: string) => void;
}) {
  const t = useTranslations('statements');
  const tc = useTranslations('common');
  const [accountId, setAccountId] = React.useState<string | null>(initialAccountId ?? (cards.length === 1 ? cards[0]!.value : null));
  const [file, setFile] = React.useState<LocalFile | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);

  async function pick() {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;
    if (asset.size && asset.size > 10 * 1024 * 1024) return setError(t('upload.tooLarge', { name: asset.name, max: '10 MB' }));
    setError(null);
    setFile({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? 'application/pdf' });
  }

  async function submit() {
    if (!accountId) return setError(t('upload.cardRequired'));
    if (!file) return setError(t('upload.fileRequired'));
    setUploading(true);
    setError(null);
    try {
      const { id } = await uploadFile<{ id: string }>('/statements', file, { accountId });
      setFile(null);
      onUploaded(id);
    } catch (e) {
      const status = e instanceof UploadError ? e.status : 0;
      setError(t(status === 0 ? 'uploadErrors.network' : status === 413 ? 'uploadErrors.tooLarge' : status === 415 || status === 400 ? 'uploadErrors.notPdf' : 'uploadErrors.failed'));
    } finally {
      setUploading(false);
    }
  }

  if (cards.length === 0) {
    return (
      <Card className="gap-2">
        <Text weight="bold" className="text-sm">
          {t('upload.title')}
        </Text>
        <Text className="text-sm text-on-surface-variant">{t('upload.noCards')}</Text>
      </Card>
    );
  }

  return (
    <Card className="gap-3">
      <Text accessibilityRole="header" weight="bold" className="text-sm">
        {t('upload.title')}
      </Text>
      <Select label={t('upload.card')} value={accountId} options={cards} onValueChange={setAccountId} placeholder={t('upload.cardPlaceholder')} closeLabel={tc('close')} />
      <Button variant="outline" icon={FileText} label={file ? file.name : t('upload.dropTitle')} onPress={() => void pick()} />
      <Text className="px-1 text-xs text-on-surface-variant">{t('upload.dropHint')}</Text>
      {error ? (
        <Text accessibilityRole="alert" className="text-sm text-expense">
          {error}
        </Text>
      ) : null}
      <TwView>
        <Button icon={Upload} label={uploading ? t('upload.uploading') : t('upload.submit')} disabled={uploading} onPress={submit} className="w-full" />
      </TwView>
    </Card>
  );
}
