import { useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { TwView, TwText, TwScrollView, TwPressable } from '@/lib/tw';
import { TwAnimatedView } from '@/lib/tw/animated';
import { TopAppBar } from '@/components/navigation/top-app-bar';
import { TransactionItemExpense } from '@/components/features/finance/transaction-item';
import { useTheme } from '@/contexts/ThemeContext';

// TODO: replace with real API calls
// const { data: cards } = useQuery({ queryKey: ['cards', 'list'], queryFn: fetchCards })
// const { data: creditInfo } = useQuery({ queryKey: ['cards', 'credit-limit'], queryFn: fetchCreditInfo })

type SecurityFeature = 'bloquear' | 'contactless' | 'internacional';
type SymbolName = SymbolViewProps['name'];

const LIGHT = {
  bg: '#f4f6fa',
  glass: 'rgba(255,255,255,0.75)',
  glassBorder: 'rgba(0,0,0,0.07)',
  text: '#1a1b22',
  subtext: 'rgba(28,28,32,0.55)',
  muted: 'rgba(28,28,32,0.35)',
  primary: '#6c72cb',
  cyan: '#006688',
  pink: '#ad009b',
} as const;

const DARK = {
  bg: '#12131a',
  glass: 'rgba(23, 24, 31, 0.65)',
  glassBorder: 'rgba(255, 255, 255, 0.08)',
  text: '#e3e1eb',
  subtext: 'rgba(199, 197, 211, 0.65)',
  muted: 'rgba(199, 197, 211, 0.4)',
  primary: '#6c72cb',
  cyan: '#27dec1',
  pink: '#ffabf2',
} as const;

const PROJECTION_SVG_URI = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  `<svg viewBox="0 0 400 120" xmlns="http://www.w3.org/2000/svg">` +
  `<defs>` +
  `<linearGradient id="lineG" x1="0" x2="1" y1="0" y2="0">` +
  `<stop offset="0" stop-color="#27dec1" stop-opacity="0.3"/>` +
  `<stop offset="1" stop-color="#27dec1" stop-opacity="1"/>` +
  `</linearGradient>` +
  `<linearGradient id="areaG" x1="0" x2="0" y1="0" y2="1">` +
  `<stop offset="0" stop-color="#27dec1" stop-opacity="0.12"/>` +
  `<stop offset="1" stop-color="#27dec1" stop-opacity="0"/>` +
  `</linearGradient>` +
  `<filter id="glow" x="-20%" y="-60%" width="140%" height="220%">` +
  `<feGaussianBlur stdDeviation="3.5" result="blur"/>` +
  `<feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>` +
  `</filter>` +
  `</defs>` +
  `<path d="M0,105 C35,88 70,98 105,65 C140,32 175,50 210,32 C245,14 280,38 400,5"` +
  ` fill="none" stroke="url(#lineG)" stroke-width="2.5" stroke-linecap="round" filter="url(#glow)"/>` +
  `<path d="M0,105 C35,88 70,98 105,65 C140,32 175,50 210,32 C245,14 280,38 400,5 L400,120 L0,120 Z"` +
  ` fill="url(#areaG)"/>` +
  `</svg>`
)}`;

type CardVariant = 'platinum' | 'stealth';

interface CardData {
  variant: CardVariant;
  tier: string;
  maskedNumber: string;
  holder: string;
  expiry: string;
}

const CARDS: CardData[] = [
  { variant: 'platinum', tier: 'PREMIUM', maskedNumber: '**** **** **** 8824', holder: 'ALEX NEUMANN', expiry: '12/28' },
  { variant: 'stealth', tier: 'STEALTH BLACK', maskedNumber: '**** **** **** 4012', holder: 'ALEX NEUMANN', expiry: '05/26' },
];

interface PaymentCardProps {
  card: CardData;
  cardWidth: number;
  index: number;
  D: typeof DARK | typeof LIGHT;
}

function PaymentCard({ card, cardWidth, index, D }: PaymentCardProps) {
  const isPlatinum = card.variant === 'platinum';

  return (
    <TwAnimatedView
      entering={FadeInUp.duration(420).delay(index * 90)}
      style={{
        width: cardWidth,
        height: 210,
        borderRadius: 22,
        marginRight: 14,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: isPlatinum ? 'rgba(191, 194, 255, 0.22)' : 'rgba(255, 255, 255, 0.05)',
        experimental_backgroundImage: isPlatinum
          ? 'linear-gradient(135deg, rgba(108,114,203,0.38) 0%, rgba(255,171,242,0.14) 100%)'
          : undefined,
        backgroundColor: isPlatinum ? undefined : '#252730',
        boxShadow: isPlatinum ? '0 8px 28px rgba(108,114,203,0.28)' : '0 4px 18px rgba(0,0,0,0.45)',
      }}
    >
      {isPlatinum ? (
        <TwView
          pointerEvents="none"
          style={{
            position: 'absolute',
            bottom: -36,
            right: -36,
            width: 144,
            height: 144,
            borderRadius: 72,
            boxShadow: '0 0 80px 40px rgba(108,114,203,0.22)',
          }}
        />
      ) : null}

      <TwView style={{ flex: 1, padding: 20, justifyContent: 'space-between' }}>
        <TwView style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <TwText
            style={{ fontFamily: 'Ubuntu Bold', fontSize: 12, letterSpacing: 2.5, color: isPlatinum ? D.primary : 'rgba(199,197,211,0.75)' }}
            accessibilityRole="text"
          >
            {card.tier}
          </TwText>
          <SymbolView
            name={isPlatinum ? 'wave.3.right' : 'cpu'}
            size={22}
            tintColor={isPlatinum ? D.pink : 'rgba(199,197,211,0.55)'}
            accessibilityLabel=""
          />
        </TwView>

        <TwView>
          <TwText
            style={{ fontFamily: 'Ubuntu', fontSize: 17, letterSpacing: 3.2, color: isPlatinum ? D.text : 'rgba(227,225,235,0.65)', marginBottom: 12 }}
            accessibilityLabel={`Número de tarjeta terminado en ${card.maskedNumber.slice(-4)}`}
          >
            {card.maskedNumber}
          </TwText>

          <TwView style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <TwView>
              <TwText style={{ fontFamily: 'Ubuntu', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1.2, color: isPlatinum ? 'rgba(227,225,235,0.5)' : 'rgba(199,197,211,0.4)', marginBottom: 3 }}>
                TITULAR
              </TwText>
              <TwText style={{ fontFamily: 'Ubuntu Medium', fontSize: 13, color: isPlatinum ? D.text : 'rgba(199,197,211,0.7)' }}>
                {card.holder}
              </TwText>
            </TwView>
            <TwView style={{ alignItems: 'flex-end' }}>
              <TwText style={{ fontFamily: 'Ubuntu', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1.2, color: isPlatinum ? 'rgba(227,225,235,0.5)' : 'rgba(199,197,211,0.4)', marginBottom: 3 }}>
                EXP
              </TwText>
              <TwText style={{ fontFamily: 'Ubuntu Medium', fontSize: 13, color: isPlatinum ? D.text : 'rgba(199,197,211,0.7)' }}>
                {card.expiry}
              </TwText>
            </TwView>
          </TwView>
        </TwView>
      </TwView>
    </TwAnimatedView>
  );
}

function CreditLimitCard({ D }: { D: typeof DARK | typeof LIGHT }) {
  const USED = 12450;
  const TOTAL = 20000;
  const pct = Math.round((USED / TOTAL) * 100);

  return (
    <TwView style={{ backgroundColor: D.glass, borderWidth: 1, borderColor: D.glassBorder, borderRadius: 20, padding: 18, minHeight: 176, justifyContent: 'space-between' }}>
      <TwView style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <SymbolView name="gauge" size={18} tintColor={D.cyan} accessibilityLabel="" />
        <TwText style={{ fontFamily: 'Ubuntu Medium', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: D.subtext }}>
          Límite de Crédito
        </TwText>
      </TwView>

      <TwView>
        <TwView style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 }}>
          <TwText style={{ fontFamily: 'Ubuntu Bold', fontSize: 28, color: D.cyan }} accessibilityRole="text" accessibilityLabel={`Crédito usado: $${USED.toLocaleString('es-MX')}`}>
            ${USED.toLocaleString('es-MX')}.00
          </TwText>
          <TwText style={{ fontFamily: 'Ubuntu', fontSize: 13, color: D.subtext }}>de $20k</TwText>
        </TwView>

        <TwView style={{ height: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }} accessibilityRole="progressbar" accessibilityLabel={`${pct}% del límite utilizado`} accessibilityValue={{ min: 0, max: 100, now: pct }}>
          <TwView style={{ height: '100%', width: `${pct}%`, backgroundColor: D.cyan, borderRadius: 4, boxShadow: '0 0 12px rgba(39,222,193,0.55)' }} />
        </TwView>
      </TwView>
    </TwView>
  );
}

function MonthlySpendingCard({ D }: { D: typeof DARK | typeof LIGHT }) {
  const sparkHeights = [40, 60, 50, 80, 100];

  return (
    <TwView style={{ backgroundColor: D.glass, borderWidth: 1, borderColor: D.glassBorder, borderRadius: 20, padding: 18, minHeight: 176, justifyContent: 'space-between' }}>
      <TwView style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <SymbolView name="chart.xyaxis.line" size={18} tintColor={D.pink} accessibilityLabel="" />
        <TwText style={{ fontFamily: 'Ubuntu Medium', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: D.subtext }}>
          Gastos del Mes
        </TwText>
      </TwView>

      <TwView>
        <TwText style={{ fontFamily: 'Ubuntu Bold', fontSize: 28, color: D.text, marginBottom: 10 }} accessibilityRole="text" accessibilityLabel="Gastos del mes: $4,280.40">
          $4,280.40
        </TwText>

        <TwView style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <TwView style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <SymbolView name="arrow.up.right" size={13} tintColor={D.pink} accessibilityLabel="" />
            <TwText style={{ fontFamily: 'Ubuntu', fontSize: 13, color: D.pink }}>12% vs anterior</TwText>
          </TwView>

          <TwView style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 40 }} accessibilityElementsHidden>
            {sparkHeights.map((h, i) => (
              <TwView
                key={i}
                style={{
                  width: 8,
                  height: h * 0.4,
                  borderTopLeftRadius: 2,
                  borderTopRightRadius: 2,
                  backgroundColor: `rgba(255,171,242,${0.18 + (i / (sparkHeights.length - 1)) * 0.82})`,
                  boxShadow: i === sparkHeights.length - 1 ? '0 0 8px rgba(255,171,242,0.45)' : undefined,
                }}
              />
            ))}
          </TwView>
        </TwView>
      </TwView>
    </TwView>
  );
}

function ExpenseProjectionCard({ D }: { D: typeof DARK | typeof LIGHT }) {
  const months = ['JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV'];

  return (
    <TwView style={{ backgroundColor: D.glass, borderWidth: 1, borderColor: D.glassBorder, borderRadius: 20, padding: 18, overflow: 'hidden' }}>
      <TwView style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <TwView style={{ flex: 1, marginRight: 12 }}>
          <TwText style={{ fontFamily: 'Ubuntu Bold', fontSize: 18, color: D.text, marginBottom: 4 }}>
            Proyección de Gastos
          </TwText>
          <TwText style={{ fontFamily: 'Ubuntu', fontSize: 13, color: D.subtext }}>
            Estimado basado en IA para los próximos 6 meses
          </TwText>
        </TwView>
        <TwPressable
          style={{ backgroundColor: 'rgba(108,114,203,0.14)', borderWidth: 1, borderColor: 'rgba(108,114,203,0.35)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, minHeight: 44, justifyContent: 'center' }}
          accessibilityRole="button"
          accessibilityLabel="Ver detalles de proyección de gastos"
        >
          <TwText style={{ fontFamily: 'Ubuntu Bold', fontSize: 11, letterSpacing: 1.5, color: D.primary }}>DETALLES</TwText>
        </TwPressable>
      </TwView>

      <TwView style={{ height: 110 }} accessibilityElementsHidden>
        <Image source={{ uri: PROJECTION_SVG_URI }} style={{ width: '100%', height: '100%' }} contentFit="fill" accessibilityElementsHidden />
      </TwView>

      <TwView style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }} accessibilityElementsHidden>
        {months.map((m) => (
          <TwText key={m} style={{ fontFamily: 'Ubuntu', fontSize: 11, color: D.muted }}>{m}</TwText>
        ))}
      </TwView>
    </TwView>
  );
}

interface SecurityToggleRowProps {
  label: string;
  symbolName: SymbolName;
  active: boolean;
  onToggle: () => void;
  D: typeof DARK | typeof LIGHT;
}

function SecurityToggleRow({ label, symbolName, active, onToggle, D }: SecurityToggleRowProps) {
  return (
    <TwPressable
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 8, borderRadius: 12, minHeight: 44 }}
      onPress={onToggle}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: active }}
    >
      <TwView style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <SymbolView name={symbolName} size={20} tintColor={active ? D.primary : 'rgba(199,197,211,0.55)'} accessibilityLabel="" />
        <TwText style={{ fontFamily: 'Ubuntu', fontSize: 15, color: D.text }}>{label}</TwText>
      </TwView>
      <TwView style={{ width: 44, height: 24, borderRadius: 12, backgroundColor: active ? 'rgba(108,114,203,0.45)' : 'rgba(255,255,255,0.1)', justifyContent: 'center', paddingHorizontal: 3 }}>
        <TwView style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: active ? D.primary : 'rgba(199,197,211,0.7)', alignSelf: active ? 'flex-end' : 'flex-start' }} />
      </TwView>
    </TwPressable>
  );
}

function SecurityControls({ security, onToggle, D }: { security: Record<SecurityFeature, boolean>; onToggle: (f: SecurityFeature) => void; D: typeof DARK | typeof LIGHT }) {
  return (
    <TwView style={{ backgroundColor: D.glass, borderWidth: 1, borderColor: D.glassBorder, borderRadius: 20, padding: 18 }}>
      <TwText style={{ fontFamily: 'Ubuntu Bold', fontSize: 18, color: D.text, marginBottom: 8 }}>Seguridad</TwText>

      <SecurityToggleRow label="Bloquear Tarjeta" symbolName="lock.fill" active={security.bloquear} onToggle={() => onToggle('bloquear')} D={D} />
      <SecurityToggleRow label="Pago Sin Contacto" symbolName="wave.3.right" active={security.contactless} onToggle={() => onToggle('contactless')} D={D} />
      <SecurityToggleRow label="Compras Int." symbolName="globe" active={security.internacional} onToggle={() => onToggle('internacional')} D={D} />

      <TwPressable
        style={{ marginTop: 18, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', experimental_backgroundImage: `linear-gradient(90deg, ${D.primary} 0%, ${D.pink} 100%)`, boxShadow: '0 4px 20px rgba(108,114,203,0.42)' }}
        accessibilityRole="button"
        accessibilityLabel="Solicitar reemplazo de tarjeta"
      >
        <TwText style={{ fontFamily: 'Ubuntu Bold', fontSize: 13, letterSpacing: 1.8, color: '#1f247c' }}>REEMPLAZAR TARJETA</TwText>
      </TwPressable>
    </TwView>
  );
}

export function CardsScreen() {
  const { isDark } = useTheme();
  const D = isDark ? DARK : LIGHT;
  const { width } = useWindowDimensions();
  const [security, setSecurity] = useState<Record<SecurityFeature, boolean>>({
    bloquear: false,
    contactless: true,
    internacional: false,
  });

  const cardWidth = Math.min(width * 0.84, 360);

  function handleSecurityToggle(feature: SecurityFeature) {
    setSecurity((prev) => ({ ...prev, [feature]: !prev[feature] }));
  }

  return (
    <TwView className="flex-1" style={{ backgroundColor: D.bg }}>
      <TopAppBar title="Finnit" notificationCount={2} onNotificationsPress={() => {}} onAvatarPress={() => {}} />

      <TwScrollView className="flex-1" contentInsetAdjustmentBehavior="automatic" contentContainerClassName="pt-5 pb-8" showsVerticalScrollIndicator={false}>

        {/* Section header */}
        <Animated.View entering={FadeInUp.duration(300)}>
          <TwView style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 20, marginBottom: 14 }}>
            <TwText style={{ fontFamily: 'Ubuntu Bold', fontSize: 22, color: D.text }}>Mis Tarjetas</TwText>
            <TwText style={{ fontFamily: 'Ubuntu Medium', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: D.subtext }}>3 ACTIVAS</TwText>
          </TwView>
        </Animated.View>

        {/* Card carousel */}
        <TwScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="px-5 pb-4"
          decelerationRate="fast"
          snapToInterval={cardWidth + 14}
          snapToAlignment="start"
          accessibilityRole="none"
          accessibilityLabel="Carrusel de tarjetas"
        >
          {CARDS.map((card, i) => (
            <PaymentCard key={card.tier} card={card} cardWidth={cardWidth} index={i} D={D} />
          ))}
        </TwScrollView>

        <Animated.View entering={FadeInUp.duration(400).delay(120)}>
          <TwView style={{ paddingHorizontal: 20, marginBottom: 14 }}>
            <CreditLimitCard D={D} />
          </TwView>
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(400).delay(180)}>
          <TwView style={{ paddingHorizontal: 20, marginBottom: 14 }}>
            <MonthlySpendingCard D={D} />
          </TwView>
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(400).delay(240)}>
          <TwView style={{ paddingHorizontal: 20, marginBottom: 14 }}>
            <ExpenseProjectionCard D={D} />
          </TwView>
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(400).delay(300)}>
          <TwView style={{ paddingHorizontal: 20, marginBottom: 14 }}>
            <SecurityControls security={security} onToggle={handleSecurityToggle} D={D} />
          </TwView>
        </Animated.View>

        {/* Recent Transactions */}
        <Animated.View entering={FadeInUp.duration(400).delay(360)}>
          <TwView style={{ paddingHorizontal: 20 }}>
            <TwText style={{ fontFamily: 'Ubuntu Bold', fontSize: 18, color: D.text, marginBottom: 12 }}>
              Transacciones Recientes
            </TwText>
            <TwView style={{ gap: 10 }}>
              <Animated.View entering={FadeInUp.duration(300).delay(400)}>
                <TransactionItemExpense merchant="Amazon Marketplace" category="Compras" time="Hoy, 14:32" amount="-$124.99" symbolName="cart.fill" onPress={() => {}} />
              </Animated.View>
              <Animated.View entering={FadeInUp.duration(300).delay(450)}>
                <TransactionItemExpense merchant="The Diner" category="Alimentos" time="Ayer, 21:15" amount="-$42.00" symbolName="fork.knife" onPress={() => {}} />
              </Animated.View>
            </TwView>
          </TwView>
        </Animated.View>

      </TwScrollView>

    </TwView>
  );
}
