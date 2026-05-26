// TODO: evaluar si mover a ui/ si resulta ser genérico
import { TwView, TwText, TwPressable } from '../../../lib/tw';
import { TwAnimatedView } from '../../../lib/tw/animated';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { FadeInRight } from 'react-native-reanimated';
import { useWindowDimensions } from 'react-native';

type CardVariant = 'platinum' | 'virtual';
type SymbolName = SymbolViewProps['name'];

interface BankPaymentCardProps {
  variant: CardVariant;
  cardTier: string;
  bankName: string;
  maskedNumber: string;
  holderName?: string;
  expiryDate?: string;
  balance?: string;
  index?: number;
  onPress?: () => void;
}

interface CardStyle {
  gradient: string;
  border: string;
  shadow: string;
  tierColor: string;
  nameColor: string;
  numberColor: string;
  labelColor: string;
  valueColor: string;
  circle1: string;
  circle2: string;
  iconName: SymbolName;
  iconColor: string;
}

const CARD_STYLES: Record<CardVariant, CardStyle> = {
  platinum: {
    gradient: 'linear-gradient(135deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.12) 100%)',
    border: 'rgba(255,255,255,0.55)',
    shadow: '0 10px 32px rgba(0,0,0,0.10)',
    tierColor: 'rgba(0,105,110,0.85)',
    nameColor: '#004f53',
    numberColor: '#191c1d',
    labelColor: 'rgba(58,73,74,0.7)',
    valueColor: '#191c1d',
    circle1: 'rgba(0,245,255,0.5)',
    circle2: 'rgba(108,114,203,0.45)',
    iconName: 'creditcard.fill',
    iconColor: 'rgba(0,105,110,0.5)',
  },
  virtual: {
    gradient: 'linear-gradient(135deg, rgba(149,0,202,0.22) 0%, rgba(149,0,202,0.08) 100%)',
    border: 'rgba(149,0,202,0.40)',
    shadow: '0 10px 32px rgba(149,0,202,0.18)',
    tierColor: 'rgba(50,0,71,0.85)',
    nameColor: '#9500ca',
    numberColor: '#320047',
    labelColor: 'rgba(50,0,71,0.6)',
    valueColor: '#320047',
    circle1: 'rgba(149,0,202,0.5)',
    circle2: 'rgba(173,0,155,0.35)',
    iconName: 'eye.slash.fill',
    iconColor: 'rgba(149,0,202,0.5)',
  },
};

export function BankPaymentCard({
  variant,
  cardTier,
  bankName,
  maskedNumber,
  holderName,
  expiryDate,
  balance,
  index = 0,
  onPress,
}: BankPaymentCardProps) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width * 0.82, 360);
  const s = CARD_STYLES[variant];

  return (
    <TwAnimatedView
      entering={FadeInRight.duration(450).delay(index * 110)}
      style={{
        width: cardWidth,
        height: 210,
        borderRadius: 28,
        marginRight: 16,
        overflow: 'hidden',
        // NW-FALLBACK: gradient via experimental_backgroundImage
        experimental_backgroundImage: s.gradient,
        borderWidth: 1,
        borderColor: s.border,
        boxShadow: s.shadow,
      }}
    >
      {/* Shimmer highlight circle */}
      <TwView
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: -80,
          right: -60,
          width: 220,
          height: 220,
          borderRadius: 110,
          backgroundColor: 'rgba(255,255,255,0.10)',
        }}
      />

      <TwPressable
        onPress={onPress}
        style={{ flex: 1, padding: 22, justifyContent: 'space-between' }}
        accessibilityRole="button"
        accessibilityLabel={`Tarjeta ${bankName} ${cardTier}, número terminado en ${maskedNumber.slice(-4)}`}
      >
        {/* Card header */}
        <TwView style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <TwView style={{ gap: 2 }}>
            <TwText
              style={{
                fontFamily: 'Ubuntu Medium',
                fontSize: 10,
                letterSpacing: 2.5,
                textTransform: 'uppercase',
                color: s.tierColor,
              }}
            >
              {cardTier}
            </TwText>
            <TwText
              style={{ fontFamily: 'Ubuntu Bold', fontSize: 19, color: s.nameColor }}
            >
              {bankName}
            </TwText>
          </TwView>
          <SymbolView
            name={s.iconName}
            size={30}
            tintColor={s.iconColor}
            accessibilityLabel=""
          />
        </TwView>

        {/* Card footer */}
        <TwView style={{ gap: 10 }}>
          <TwText
            style={{
              fontFamily: 'Ubuntu',
              fontSize: 19,
              letterSpacing: 3.5,
              color: s.numberColor,
            }}
          >
            {maskedNumber}
          </TwText>

          <TwView style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            {balance ? (
              <TwView>
                <TwText style={{ fontFamily: 'Ubuntu', fontSize: 9, textTransform: 'uppercase', color: s.labelColor, letterSpacing: 1 }}>
                  Saldo Virtual
                </TwText>
                <TwText style={{ fontFamily: 'Ubuntu Medium', fontSize: 14, color: s.valueColor }}>
                  {balance}
                </TwText>
              </TwView>
            ) : (
              <TwView style={{ flexDirection: 'row', gap: 20 }}>
                {holderName ? (
                  <TwView>
                    <TwText style={{ fontFamily: 'Ubuntu', fontSize: 9, textTransform: 'uppercase', color: s.labelColor, letterSpacing: 1 }}>
                      Titular
                    </TwText>
                    <TwText style={{ fontFamily: 'Ubuntu Medium', fontSize: 13, color: s.valueColor }}>
                      {holderName}
                    </TwText>
                  </TwView>
                ) : null}
                {expiryDate ? (
                  <TwView>
                    <TwText style={{ fontFamily: 'Ubuntu', fontSize: 9, textTransform: 'uppercase', color: s.labelColor, letterSpacing: 1 }}>
                      Expira
                    </TwText>
                    <TwText style={{ fontFamily: 'Ubuntu Medium', fontSize: 13, color: s.valueColor }}>
                      {expiryDate}
                    </TwText>
                  </TwView>
                ) : null}
              </TwView>
            )}

            {/* Card network circles */}
            <TwView style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TwView style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: s.circle1, zIndex: 1 }} />
              <TwView style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: s.circle2, marginLeft: -8 }} />
            </TwView>
          </TwView>
        </TwView>
      </TwPressable>
    </TwAnimatedView>
  );
}
