import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './card';
import { Button } from './button';
import { GlassCard } from './glass-card';
import { SectionHeading } from './section-heading';
import { Separator } from './separator';

const meta = {
  title: 'UI/Surfaces',
  component: Card,
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DefaultCard: Story = {
  render: () => (
    <Card className="max-w-sm">
      <CardHeader>
        <div>
          <CardTitle>Proyección de gastos</CardTitle>
          <CardDescription>Estimado para los próximos 6 meses</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="text-sm text-on-surface-variant">
        Contenido de la tarjeta.
      </CardContent>
      <CardFooter>
        <Button size="sm" variant="outline" label="Detalles" />
      </CardFooter>
    </Card>
  ),
};

export const Glass: Story = {
  render: () => (
    <div className="relative max-w-sm overflow-hidden rounded-card p-6">
      <div className="absolute -top-10 -left-10 size-40 rounded-full bg-[#6c72cb]/40 blur-2xl" />
      <div className="absolute -right-10 -bottom-10 size-40 rounded-full bg-[#00f5ff]/30 blur-2xl" />
      <GlassCard className="relative p-6 text-on-background">
        GlassCard (equivalente a FinnGlassView)
      </GlassCard>
    </div>
  ),
};

export const Heading: Story = {
  render: () => (
    <div className="max-w-md">
      <SectionHeading
        title="Actividad Reciente"
        action={
          <a href="#" className="text-sm font-medium text-income">
            Ver todo
          </a>
        }
      />
      <Separator />
    </div>
  ),
};
