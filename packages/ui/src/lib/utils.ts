import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Teach tailwind-merge the custom @theme tokens from globals.css; otherwise
// `text-headline-lg` is read as a color and dropped next to `text-brand`.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['display-lg', 'headline-lg', 'title-lg', 'body-md', 'label-sm'],
      radius: ['card', 'button', 'chip', 'input'],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
