import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from './button';
import { Toaster, toast } from './toaster';

const meta = {
  title: 'UI/Toaster',
  component: Toaster,
} satisfies Meta<typeof Toaster>;

export default meta;
type Story = StoryObj<typeof meta>;

const Example = () => (
  <div className="flex flex-wrap gap-2">
    <Toaster position="bottom-right" />
    <Button
      variant="outline"
      label="Default"
      onClick={() =>
        toast('Transacción guardada', {
          description: 'Amazon Store · -$142.50',
          action: { label: 'Deshacer', onClick: () => undefined },
        })
      }
    />
    <Button
      variant="outline"
      label="Success"
      onClick={() => toast.success('Estado de cuenta importado')}
    />
    <Button
      variant="outline"
      label="Info"
      onClick={() => toast.info('Sincronizando con tu banco…')}
    />
    <Button
      variant="outline"
      label="Warning"
      onClick={() => toast.warning('Tu presupuesto de comida va al 90%')}
    />
    <Button
      variant="outline"
      label="Error"
      onClick={() =>
        toast.error('No se pudo conectar', {
          description: 'Intenta de nuevo en unos minutos.',
        })
      }
    />
    <Button
      variant="outline"
      label="Loading"
      onClick={() => toast.loading('Subiendo archivo…')}
    />
  </div>
);

export const Default: Story = { render: () => <Example /> };
export const Light: Story = {
  render: () => <Example />,
  parameters: { themes: { themeOverride: 'light' } },
};
export const Dark: Story = {
  render: () => <Example />,
  parameters: { themes: { themeOverride: 'dark' } },
};
