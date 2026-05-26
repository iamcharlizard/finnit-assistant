import { useCssElement } from 'react-native-css';
import { Image, type ImageProps } from 'expo-image';

const mapping = { className: 'style' } as const;

export function TwImage(props: ImageProps & { className?: string }) {
  return useCssElement(Image, props, mapping);
}
