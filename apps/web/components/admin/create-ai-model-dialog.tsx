'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@finnit/ui/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@finnit/ui/components/ui/dialog';
import { Input } from '@finnit/ui/components/ui/input';
import { Label } from '@finnit/ui/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@finnit/ui/components/ui/select';
import { Switch } from '@finnit/ui/components/ui/switch';

import {
  CREATE_AI_MODEL_MUTATION,
  PROVIDER_LABELS,
  type AiProvider,
} from '@/lib/admin/ai';
import { adminErrorMessage } from '@/lib/admin/errors';
import { gql } from '@/lib/graphql/client';

/** "Agregar modelo" to the AI catalog. Mounted while open. */
export function CreateAiModelDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [provider, setProvider] = React.useState<AiProvider>('anthropic');
  const [modelId, setModelId] = React.useState('');
  const [label, setLabel] = React.useState('');
  const [supportsPdf, setSupportsPdf] = React.useState(true);
  const [isActive, setIsActive] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const t = useTranslations();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!modelId.trim() || !label.trim()) {
      setError(t('admin.errors.modelFieldsRequired'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await gql(CREATE_AI_MODEL_MUTATION, {
        input: {
          provider,
          modelId: modelId.trim(),
          label: label.trim(),
          supportsPdf,
          isActive,
        },
      });
      onCreated();
      onClose();
    } catch (e) {
      setError(adminErrorMessage(e, t));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={t('common.close')}>
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{t('admin.ai.create.title')}</DialogTitle>
            <DialogDescription>
              {t('admin.ai.create.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="model-provider">
              {t('admin.ai.create.provider')}
            </Label>
            <Select
              value={provider}
              onValueChange={(v) => setProvider(v as AiProvider)}
            >
              <SelectTrigger id="model-provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PROVIDER_LABELS) as AiProvider[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {PROVIDER_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Input
            label={t('admin.ai.create.model')}
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            placeholder="claude-haiku-5-5"
            autoComplete="off"
            spellCheck={false}
            className="font-mono"
          />
          <Input
            label={t('admin.ai.create.label')}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Claude Haiku"
            autoComplete="off"
          />
          <div className="flex flex-col gap-3">
            <div className="flex min-h-11 items-center justify-between gap-3">
              <label htmlFor="model-pdf" className="text-sm">
                {t('admin.ai.create.readsPdf')}
              </label>
              <Switch
                id="model-pdf"
                checked={supportsPdf}
                onCheckedChange={setSupportsPdf}
              />
            </div>
            <div className="flex min-h-11 items-center justify-between gap-3">
              <label htmlFor="model-active" className="text-sm">
                {t('admin.ai.create.active')}
              </label>
              <Switch
                id="model-active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>
          </div>

          {error ? (
            <p role="alert" className="text-[13px] text-expense">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" variant="secondary" disabled={saving}>
              {saving ? t('admin.ai.create.adding') : t('admin.ai.addModel')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
