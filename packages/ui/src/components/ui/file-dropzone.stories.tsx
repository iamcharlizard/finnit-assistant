import type { Meta, StoryObj } from '@storybook/react-vite';

import { FileDropzone } from './file-dropzone';

const meta = {
  title: 'UI/FileDropzone',
  component: FileDropzone,
  args: {
    accept: '.pdf,application/pdf',
    maxSizeBytes: 10 * 1024 * 1024,
    description: 'PDF up to 10 MB',
  },
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FileDropzone>;

export default meta;
type Story = StoryObj<typeof meta>;

const sample = (name: string, size: number, type: string) =>
  new File([new Uint8Array(size)], name, { type });

export const Default: Story = {};
export const Multiple: Story = {
  args: {
    multiple: true,
    accept: '.pdf,image/*',
    description: 'PDF or images',
  },
};
export const WithFiles: Story = {
  args: {
    multiple: true,
    value: [
      sample('estado-de-cuenta-sep.pdf', 245_000, 'application/pdf'),
      sample('estado-de-cuenta-oct.pdf', 1_830_000, 'application/pdf'),
    ],
  },
};
export const CameraCapture: Story = {
  args: {
    accept: 'image/*',
    capture: 'environment',
    title: 'Toma una foto del ticket o elige una imagen',
    description: 'JPG o PNG, máximo 5 MB',
    maxSizeBytes: 5 * 1024 * 1024,
  },
};
export const SpanishTexts: Story = {
  args: {
    title: 'Arrastra tu estado de cuenta o haz clic para elegirlo',
    description: 'PDF de hasta 10 MB',
    dragActiveText: 'Suelta para agregar',
    removeLabel: (name) => `Quitar ${name}`,
    tooLargeText: (name, max) => `${name} pesa más de ${max}.`,
    wrongTypeText: (name) => `${name} no es un PDF.`,
  },
};
export const WithError: Story = {
  args: { error: 'Upload failed. Try again.' },
};
export const Disabled: Story = { args: { disabled: true } };
export const Light: Story = {
  parameters: { themes: { themeOverride: 'light' } },
};
export const Dark: Story = {
  parameters: { themes: { themeOverride: 'dark' } },
};
