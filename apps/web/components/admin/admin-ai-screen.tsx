'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@finnit/ui/components/ui/card';
import { BodyMd } from '@finnit/ui/components/ui/typography';

import {
  AI_SETTINGS_QUERY,
  DELETE_AI_MODEL_MUTATION,
  needsPdfModel,
  UPDATE_AI_FEATURE_MUTATION,
  UPDATE_AI_MODEL_MUTATION,
  type AiFeature,
  type AiModel,
} from '@/lib/admin/ai';
import { adminErrorMessage } from '@/lib/admin/errors';
import { gql } from '@/lib/graphql/client';
import { AiFeatureRow, type AiFeatureChange } from './ai-feature-row';
import { AiModelRow, type AiModelChange } from './ai-model-row';
import { ConfirmDialog, type ConfirmRequest } from './confirm-dialog';
import { CreateAiModelDialog } from './create-ai-model-dialog';

/** /admin/ai: what each AI feature may do and the model catalog. */
export function AdminAiScreen() {
  const t = useTranslations();
  const [features, setFeatures] = React.useState<AiFeature[]>([]);
  const [models, setModels] = React.useState<AiModel[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [confirm, setConfirm] = React.useState<ConfirmRequest | null>(null);

  const load = React.useCallback(async () => {
    try {
      const data = await gql<{ aiFeatures: AiFeature[]; aiModels: AiModel[] }>(
        AI_SETTINGS_QUERY,
      );
      setFeatures(data.aiFeatures);
      setModels(data.aiModels);
      setLoadError(null);
    } catch (e) {
      setLoadError(adminErrorMessage(e, t));
    } finally {
      setLoading(false);
    }
  }, [t]);

  React.useEffect(() => {
    void load();
  }, [load]);

  /** Runs a change and reloads: one edit can affect features and models. */
  async function mutate(query: string, variables: Record<string, unknown>) {
    setError(null);
    try {
      await gql(query, variables);
    } catch (e) {
      setError(adminErrorMessage(e, t));
    }
    await load();
  }

  const updateFeature = (feature: AiFeature, input: AiFeatureChange) =>
    mutate(UPDATE_AI_FEATURE_MUTATION, { key: feature.key, input });
  const updateModel = (model: AiModel, input: AiModelChange) =>
    mutate(UPDATE_AI_MODEL_MUTATION, { id: model.id, input });
  const deleteModel = (model: AiModel) =>
    setConfirm({
      title: t('admin.ai.deleteTitle', { label: model.label }),
      description: t('admin.ai.deleteDescription'),
      confirmLabel: t('admin.ai.delete'),
      destructive: true,
      onConfirm: () => void mutate(DELETE_AI_MODEL_MUTATION, { id: model.id }),
    });

  const activeModels = models.filter((m) => m.isActive);
  const pdfModels = activeModels.filter((m) => m.supportsPdf);

  if (loading) {
    return (
      <BodyMd className="text-on-surface-variant">{t('common.loading')}</BodyMd>
    );
  }
  if (loadError) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-card bg-track p-6 text-center">
        <BodyMd className="text-expense">{loadError}</BodyMd>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          {t('common.retry')}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <p role="alert" className="text-[13px] text-expense">
          {error}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t('admin.ai.featuresTitle')}</CardTitle>
            <CardDescription>
              {t('admin.ai.featuresDescription')}
            </CardDescription>
          </div>
        </CardHeader>
        {features.map((feature) => (
          <AiFeatureRow
            key={feature.key}
            feature={feature}
            models={needsPdfModel(feature.key) ? pdfModels : activeModels}
            onChange={(change) => updateFeature(feature, change)}
          />
        ))}
      </Card>

      <Card>
        <CardHeader className="flex-wrap">
          <div>
            <CardTitle>{t('admin.ai.modelsTitle')}</CardTitle>
            <CardDescription>{t('admin.ai.modelsDescription')}</CardDescription>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> {t('admin.ai.addModel')}
          </Button>
        </CardHeader>
        {models.length === 0 ? (
          <BodyMd className="rounded-xl bg-track p-4 text-center text-on-surface-variant">
            {t('admin.ai.noModels')}
          </BodyMd>
        ) : (
          models.map((model) => (
            <AiModelRow
              key={model.id}
              model={model}
              onChange={(change) => updateModel(model, change)}
              onDelete={() => deleteModel(model)}
            />
          ))
        )}
      </Card>

      {adding ? (
        <CreateAiModelDialog
          onClose={() => setAdding(false)}
          onCreated={() => void load()}
        />
      ) : null}
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}
