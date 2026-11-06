'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Camera, Trash2 } from 'lucide-react';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@finnit/ui/components/ui/avatar';
import { Button } from '@finnit/ui/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@finnit/ui/components/ui/dialog';
import { Input } from '@finnit/ui/components/ui/input';
import { toast } from '@finnit/ui/components/ui/toaster';
import { useDialogExit } from '@finnit/ui/lib/use-dialog-exit';

import { initials, useSessionUser } from '@/components/session-provider';
import { gql, requestErrorMessage } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';
import { avatarSrc } from '@/lib/profile/avatar';
import {
  AVATAR_TYPES,
  isAcceptedPhoto,
  squarePhoto,
  uploadAvatar,
} from '@/lib/profile/photo';

const UPDATE_NAME_MUTATION = `mutation UpdateMyName($input: UpdateUserInput!) { updateUser(input: $input) { id } }`;
const REMOVE_AVATAR_MUTATION = `mutation RemoveMyAvatar { removeMyAvatar { id } }`;

const NAME_MIN = 2;
const NAME_MAX = 50;

/** What happens to the photo on save. */
type PhotoChange =
  | { kind: 'keep' }
  | { kind: 'remove' }
  | { kind: 'upload'; blob: Blob; preview: string };

/**
 * Edit the profile: the photo (upload one, cropped to a square in the
 * browser, or remove it to go back to the Google picture or the initials)
 * and the name. The email is fixed: access is by invitation.
 */
export function ProfileDialog({ onClose }: { onClose: () => void }) {
  const exit = useDialogExit();
  const user = useSessionUser();
  const router = useRouter();
  const { t } = useLocalizer();
  const tp = useTranslations('profile');
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [name, setName] = React.useState(user.name);
  const [photo, setPhoto] = React.useState<PhotoChange>({ kind: 'keep' });
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  // The preview's object URL goes away with the dialog or a new pick.
  React.useEffect(
    () => () => {
      if (photo.kind === 'upload') URL.revokeObjectURL(photo.preview);
    },
    [photo],
  );

  const current = avatarSrc(user.avatar);
  const uploaded = user.avatar?.source === 'uploaded';
  const shown =
    photo.kind === 'upload'
      ? photo.preview
      : photo.kind === 'remove'
        ? null
        : current;
  const nameTrimmed = name.trim();
  const nameError =
    nameTrimmed.length < NAME_MIN || nameTrimmed.length > NAME_MAX
      ? tp('nameLength', { min: NAME_MIN, max: NAME_MAX })
      : null;
  const changed = photo.kind !== 'keep' || nameTrimmed !== user.name;

  async function pick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!isAcceptedPhoto(file)) {
      setError(tp('photoType'));
      return;
    }
    setError(null);
    try {
      const blob = await squarePhoto(file);
      setPhoto({ kind: 'upload', blob, preview: URL.createObjectURL(blob) });
    } catch {
      setError(tp('photoUnreadable'));
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (nameError || !changed) return;
    setSaving(true);
    setError(null);
    try {
      if (photo.kind === 'upload') await uploadAvatar(photo.blob);
      if (photo.kind === 'remove') await gql(REMOVE_AVATAR_MUTATION);
      if (nameTrimmed !== user.name) {
        await gql(UPDATE_NAME_MUTATION, { input: { name: nameTrimmed } });
      }
      toast.success(tp('saved'));
      // The session user comes from the server layout.
      router.refresh();
      exit.close(onClose);
    } catch (e) {
      setError(
        e instanceof Error && e.name === 'AvatarUploadError'
          ? tp('photoFailed')
          : requestErrorMessage(e, t),
      );
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={exit.open}
      onOpenChange={(open) => !open && !saving && exit.close(onClose)}
    >
      <DialogContent
        onExitComplete={exit.onExitComplete}
        closeLabel={t('common.close')}
        className="sm:max-w-md"
      >
        <form onSubmit={save} noValidate className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{tp('title')}</DialogTitle>
            <DialogDescription>{tp('description')}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="flex items-center gap-4">
              <Avatar className="size-20 border-2 border-primary">
                {shown ? (
                  <AvatarImage
                    src={shown}
                    alt=""
                    referrerPolicy="no-referrer"
                  />
                ) : null}
                <AvatarFallback className="text-xl">
                  {initials(nameTrimmed || user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-start gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept={AVATAR_TYPES.join(',')}
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden
                  onChange={pick}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={saving}
                  onClick={() => fileRef.current?.click()}
                >
                  <Camera aria-hidden /> {tp('changePhoto')}
                </Button>
                {uploaded && photo.kind !== 'remove' ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={saving}
                    onClick={() => setPhoto({ kind: 'remove' })}
                  >
                    <Trash2 aria-hidden /> {tp('removePhoto')}
                  </Button>
                ) : null}
                <p className="text-xs text-on-surface-variant">
                  {photo.kind === 'remove' && user.avatar?.source === 'uploaded'
                    ? tp('afterRemove')
                    : tp('photoHint')}
                </p>
              </div>
            </div>

            <Input
              label={tp('name')}
              value={name}
              maxLength={NAME_MAX}
              autoComplete="name"
              onChange={(e) => setName(e.target.value)}
              error={nameError ?? undefined}
            />
            <Input label={tp('email')} value={user.email} disabled readOnly />
            <p className="-mt-2 px-1 text-xs text-on-surface-variant">
              {tp('emailHint')}
            </p>

            {error ? (
              <p role="alert" className="text-sm text-expense">
                {error}
              </p>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={saving}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={saving || !changed || Boolean(nameError)}
            >
              {saving ? tp('saving') : tp('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
