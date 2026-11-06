import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Register the theme's custom sizes, radii and fonts, or twMerge treats
// e.g. `text-body-md` as a color and drops it next to `text-on-background`.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['display-lg', 'headline-lg', 'title-lg', 'body-md', 'label-sm'],
      radius: ['card', 'button', 'chip', 'input'],
      font: ['ubuntu', 'ubuntu-medium', 'ubuntu-bold'],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
