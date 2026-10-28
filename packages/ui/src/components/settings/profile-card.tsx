'use client';

import { BadgeCheck } from 'lucide-react';

import { cn } from '../../lib/utils';

interface ProfileCardProps {
  name: string;
  email: string;
  isPremium?: boolean;
  isVerified?: boolean;
  onEditClick?: () => void;
  editLabel?: string;
  premiumLabel?: string;
  verifiedLabel?: string;
  /** Accessible name of the initials avatar; receives the user's name. */
  avatarLabel?: (name: string) => string;
  className?: string;
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function ProfileCard({
  name,
  email,
  isPremium = false,
  isVerified = false,
  onEditClick,
  editLabel = 'Edit profile',
  premiumLabel = 'Premium',
  verifiedLabel = 'Verified account',
  avatarLabel = (userName) => `User avatar: ${userName}`,
  className,
}: ProfileCardProps) {
  return (
    <section
      className={cn(
        'relative flex flex-col items-center overflow-hidden rounded-card border border-glass-border bg-glass p-5 shadow-[0_8px_32px_rgba(0,0,0,0.06)] backdrop-blur-md dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]',
        className,
      )}
    >
      {isPremium ? (
        <span className="absolute top-3 right-3 rounded-full bg-highlight/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-highlight dark:bg-[#781e74]/75 dark:shadow-[0_0_15px_rgba(255,171,242,0.35)]">
          {premiumLabel}
        </span>
      ) : null}

      <div className="relative mt-2 mb-4">
        <div className="size-24 rounded-full bg-[linear-gradient(135deg,#6c72cb_0%,var(--highlight)_50%,var(--tertiary)_100%)] p-[3px]">
          <div
            aria-label={avatarLabel(name)}
            role="img"
            className="flex size-full items-center justify-center rounded-full bg-[#f0f0f8] text-3xl font-bold text-violet-ink dark:bg-[#1e1f26]"
          >
            {getInitials(name)}
          </div>
        </div>
        {isVerified ? (
          <span className="absolute right-0 bottom-0 flex size-7 items-center justify-center rounded-full border-2 border-surface bg-tertiary shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
            <BadgeCheck
              aria-label={verifiedLabel}
              className="size-3.5 text-white dark:text-[#003428]"
            />
          </span>
        ) : null}
      </div>

      <h2 className="mb-1 text-[22px] font-bold text-on-background">{name}</h2>
      <p className="mb-5 text-sm text-on-surface-variant">{email}</p>

      <button
        type="button"
        onClick={onEditClick}
        className="min-h-11 rounded-full border border-[#6c72cb]/30 bg-[#6c72cb]/10 px-8 text-sm font-medium text-violet-ink outline-none transition-colors hover:bg-[#6c72cb]/15 focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:text-[#bfc2ff]"
      >
        {editLabel}
      </button>
    </section>
  );
}

export { ProfileCard, type ProfileCardProps };
