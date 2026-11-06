import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChevronRight, Fingerprint, Lock, ShieldCheck } from 'lucide-react';

import { Switch } from '../ui/switch';
import { ProfileCard } from './profile-card';
import { SettingRow } from './setting-row';
import { SettingsSection } from './settings-section';

const meta = {
  title: 'Settings/SettingsSection',
  component: SettingsSection,
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SettingsSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Security: Story = {
  args: {
    title: 'Seguridad',
    icon: ShieldCheck,
    iconColor: 'var(--tertiary)',
    children: null,
  },
  render: (args) => (
    <SettingsSection {...args}>
      <SettingRow label="Biometría" icon={Fingerprint} controlId="bio">
        <Switch id="bio" defaultChecked />
      </SettingRow>
      <SettingRow label="Cambiar PIN" icon={Lock}>
        <ChevronRight aria-hidden className="size-4 text-on-surface-variant" />
      </SettingRow>
      <SettingRow
        label="Resumen semanal"
        description="Email"
        controlId="weekly"
      >
        <Switch id="weekly" />
      </SettingRow>
    </SettingsSection>
  ),
};

export const Profile: Story = {
  args: { title: '', icon: ShieldCheck, iconColor: '', children: null },
  render: () => (
    <ProfileCard
      name="Alex Neumann"
      email="alex@finnit.com"
      isPremium
      isVerified
    />
  ),
};

/** With a photo; a broken URL falls back to the initials. */
export const ProfileWithPhoto: Story = {
  args: { title: '', icon: ShieldCheck, iconColor: '', children: null },
  render: () => (
    <ProfileCard
      name="Alex Neumann"
      email="alex@finnit.com"
      avatarSrc="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'><rect width='96' height='96' fill='%236c72cb'/><circle cx='48' cy='38' r='18' fill='white'/><rect x='18' y='62' width='60' height='34' rx='17' fill='white'/></svg>"
      isVerified
    />
  ),
};
