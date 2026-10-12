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
