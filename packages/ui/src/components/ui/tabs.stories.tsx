import type { Meta, StoryObj } from '@storybook/react-vite';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';

const meta = {
  title: 'UI/Tabs',
  component: Tabs,
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

const Example = () => (
  <Tabs defaultValue="expenses" className="max-w-md">
    <TabsList aria-label="Tipo de movimiento">
      <TabsTrigger value="expenses">
        <ArrowUpRight aria-hidden /> Gastos
      </TabsTrigger>
      <TabsTrigger value="income">
        <ArrowDownLeft aria-hidden /> Ingresos
      </TabsTrigger>
      <TabsTrigger value="transfers" disabled>
        Transferencias
      </TabsTrigger>
    </TabsList>
    <TabsContent value="expenses" className="text-sm text-on-surface-variant">
      Lista de gastos del mes.
    </TabsContent>
    <TabsContent value="income" className="text-sm text-on-surface-variant">
      Lista de ingresos del mes.
    </TabsContent>
  </Tabs>
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
