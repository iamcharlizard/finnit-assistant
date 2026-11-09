import { Redirect } from 'expo-router';

/** "Clasificar" lives in Movimientos now ("Por clasificar"): old links land there. */
export default function CategorizeRedirect() {
  return (
    <Redirect
      href={{ pathname: '/history', params: { review: '1', month: 'all' } }}
    />
  );
}
