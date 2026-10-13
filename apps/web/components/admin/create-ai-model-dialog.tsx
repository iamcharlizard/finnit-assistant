'use client';

import * as React from 'react';

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

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!modelId.trim() || !label.trim()) {
      setError('Escribe el modelo y su nombre.');
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
      setError(adminErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>Agregar modelo</DialogTitle>
            <DialogDescription>
              Usa el nombre exacto del modelo en el proveedor. Su llave se
              configura en el servidor de la API.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="model-provider">Proveedor</Label>
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
            label="Modelo"
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            placeholder="claude-haiku-5-5"
            autoComplete="off"
            spellCheck={false}
            className="font-mono"
          />
          <Input
            label="Nombre visible"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Claude Haiku"
            autoComplete="off"
          />
          <div className="flex flex-col gap-3">
            <div className="flex min-h-11 items-center justify-between gap-3">
              <label htmlFor="model-pdf" className="text-sm">
                Lee archivos PDF
              </label>
              <Switch
                id="model-pdf"
                checked={supportsPdf}
                onCheckedChange={setSupportsPdf}
              />
            </div>
            <div className="flex min-h-11 items-center justify-between gap-3">
              <label htmlFor="model-active" className="text-sm">
                Activo
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
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" variant="secondary" disabled={saving}>
              {saving ? 'Agregando…' : 'Agregar modelo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
