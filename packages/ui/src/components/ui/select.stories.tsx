import type { Meta, StoryObj } from '@storybook/react-vite';

import { Label } from './label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from './select';

const meta = {
  title: 'UI/Select',
  component: Select,
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="flex w-64 flex-col gap-1">
      <Label htmlFor="role">Rol</Label>
      <Select defaultValue="user">
        <SelectTrigger id="role">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="user">Usuario</SelectItem>
          <SelectItem value="admin">Administrador</SelectItem>
          <SelectSeparator />
          <SelectItem value="master" disabled>
            Maestro
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
};

export const Placeholder: Story = {
  render: () => (
    <Select>
      <SelectTrigger className="w-64">
        <SelectValue placeholder="Elige un modelo" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="haiku">Claude Haiku</SelectItem>
        <SelectItem value="gpt">GPT</SelectItem>
        <SelectItem value="gemini">Gemini Flash</SelectItem>
      </SelectContent>
    </Select>
  ),
};
