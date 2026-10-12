import type { Meta, StoryObj } from '@storybook/react-vite';

import { BodyMd, DisplayLg, HeadlineLg, LabelSm, TitleLg } from './typography';

const meta = {
  title: 'UI/Typography',
  component: DisplayLg,
} satisfies Meta<typeof DisplayLg>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Scale: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <DisplayLg>$45,280.00 · Display LG</DisplayLg>
      <HeadlineLg>Bienvenido de nuevo · Headline LG</HeadlineLg>
      <TitleLg>Actividad reciente · Title LG</TitleLg>
      <BodyMd>Gestiona tus finanzas con precisión Finnit. · Body MD</BodyMd>
      <LabelSm>Balance total · Label SM</LabelSm>
    </div>
  ),
};
