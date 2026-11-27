import * as React from 'react';
import { Keyboard, LayoutAnimation, Platform, type KeyboardEvent } from 'react-native';

/** The keyboard's height while it shows (0 when hidden), animated like it on iOS. */
export function useKeyboardHeight(): number {
  const [height, setHeight] = React.useState(0);
  React.useEffect(() => {
    const ios = Platform.OS === 'ios';
    const follow = (next: number) => (event: KeyboardEvent) => {
      if (ios && event.duration) {
        LayoutAnimation.configureNext({
          duration: event.duration,
          update: { type: LayoutAnimation.Types.keyboard },
        });
      }
      setHeight(next || 0);
    };
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (event) =>
      follow(event.endCoordinates.height)(event),
    );
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', (event) => follow(0)(event));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}
