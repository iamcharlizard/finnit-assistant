import { ImageResponse } from 'next/og';
import { getTranslations } from 'next-intl/server';

export const alt = 'Finnit';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const FACETS = [
  [
    '#00f5ff',
    'M38.6 97.2L72 39.3L60.9 20L49.7 39.3L54 46.8L31.7 85.4ZM98.6 124L109.7 104.7L76.3 46.8L69.4 58.6L89.1 92.8L94.3 92.8L101.1 104.7L94.3 116.5ZM23.1 124L34.3 104.7L23.1 85.4L12 104.7Z',
  ],
  [
    '#6c72cb',
    'M52.3 97.2L72 63.1L69.4 58.6L76.3 46.8L90 46.8L94.3 39.3L72 39.3L38.6 97.2ZM45.4 124L49.7 116.5L94.3 116.5L101.1 104.7L34.3 104.7L23.1 124ZM120.9 124L132 104.7L109.7 104.7L98.6 124Z',
  ],
  [
    '#5b61c2',
    'M72 39.3L94.3 39.3L83.1 20L60.9 20ZM109.7 104.7L132 104.7L120.9 85.4L112.3 85.4L90 46.8L76.3 46.8ZM34.3 104.7L101.1 104.7L94.3 92.8L54.9 92.8L52.3 97.2L38.6 97.2L31.7 85.4L23.1 85.4Z',
  ],
] as const;

/** Link preview for the landing page: the dark logo and the headline. */
export default async function OpengraphImage() {
  const t = await getTranslations('landing.hero');
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '80px',
        background:
          'radial-gradient(60% 70% at 85% 20%, rgba(108,114,203,0.45) 0%, rgba(18,19,26,0) 70%), radial-gradient(50% 60% at 10% 100%, rgba(0,245,255,0.22) 0%, rgba(18,19,26,0) 70%), #12131a',
        color: '#f1f1f6',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        <svg width="112" height="98" viewBox="8 16 128 112">
          {FACETS.map(([fill, d]) => (
            <path key={fill} d={d} fill={fill} />
          ))}
        </svg>
        <span
          style={{ fontSize: 64, fontWeight: 700, letterSpacing: '-0.03em' }}
        >
          Finnit
        </span>
      </div>
      <div
        style={{
          marginTop: 56,
          fontSize: 68,
          fontWeight: 700,
          lineHeight: 1.05,
          letterSpacing: '-0.035em',
        }}
      >
        {t('slides.photo.title')}
      </div>
      <div
        style={{
          fontSize: 68,
          fontWeight: 700,
          lineHeight: 1.05,
          letterSpacing: '-0.035em',
          color: '#00f5ff',
        }}
      >
        {t('titleAccent')}
      </div>
      <div style={{ marginTop: 32, fontSize: 28, color: '#a9acc0' }}>
        {t('eyebrow')}
      </div>
    </div>,
    size,
  );
}
