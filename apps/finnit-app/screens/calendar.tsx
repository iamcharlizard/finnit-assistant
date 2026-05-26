import { useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { SymbolView } from 'expo-symbols';
import { TwView, TwText, TwScrollView, TwPressable } from '@/lib/tw';
import { TopAppBar } from '@/components/navigation/top-app-bar';
import { PaymentItem } from '@/components/features/finance/payment-item';
import { useTheme } from '@/contexts/ThemeContext';

// TODO: replace with real API calls
// const { data } = useQuery({ queryKey: ['calendar-payments'], queryFn: fetchCalendarPayments })
// const { data: projections } = useQuery({ queryKey: ['monthly-projections'], queryFn: fetchMonthlyProjections })

const TEAL = '#00696e';
const TEAL_BRIGHT = '#00f5ff';
const PURPLE = '#6c72cb';

type CalendarViewMode = 'month' | 'week';

type CalendarCell =
  | { kind: 'prev'; day: number }
  | { kind: 'current'; day: number };

interface CalendarEvent {
  label: string;
  accent: 'primary' | 'neon';
}

const DAY_HEADERS: readonly string[] = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

const CALENDAR_CELLS: readonly CalendarCell[] = [
  { kind: 'prev', day: 25 },
  { kind: 'prev', day: 26 },
  { kind: 'prev', day: 27 },
  { kind: 'prev', day: 28 },
  { kind: 'prev', day: 29 },
  { kind: 'prev', day: 30 },
  ...Array.from({ length: 28 }, (_, i): CalendarCell => ({ kind: 'current', day: i + 1 })),
];

const EVENTS: Partial<Record<number, CalendarEvent>> = {
  3: { label: 'Alquiler', accent: 'primary' },
  10: { label: 'Seguro', accent: 'neon' },
};

const TODAY_DAY = 12;
const SCREEN_H_PAD = 16;
const CARD_PAD = 16;
const CELL_GAP = 3;

interface DayCellProps {
  cell: CalendarCell;
  cellSize: number;
  isSelected: boolean;
  onPress: () => void;
  isDark: boolean;
}

function DayCell({ cell, cellSize, isSelected, onPress, isDark }: DayCellProps) {
  const isPrev = cell.kind === 'prev';
  const day = cell.day;
  const isToday = !isPrev && day === TODAY_DAY;
  const event: CalendarEvent | undefined = !isPrev ? EVENTS[day] : undefined;

  const borderColor = isToday
    ? TEAL
    : event?.accent === 'primary'
    ? 'rgba(0,105,110,0.4)'
    : event?.accent === 'neon'
    ? 'rgba(108,114,203,0.4)'
    : isPrev
    ? 'transparent'
    : isDark
    ? 'rgba(255,255,255,0.07)'
    : 'rgba(0,0,0,0.07)';

  const bgColor = isToday
    ? 'rgba(0,245,255,0.06)'
    : event?.accent === 'primary'
    ? 'rgba(0,245,255,0.05)'
    : event?.accent === 'neon'
    ? 'rgba(108,114,203,0.05)'
    : isSelected
    ? isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
    : 'transparent';

  const dayColor = isPrev
    ? isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'
    : isToday
    ? TEAL
    : event?.accent === 'primary'
    ? TEAL
    : event?.accent === 'neon'
    ? PURPLE
    : isDark ? '#e3e1eb' : '#1a1b22';

  return (
    <TwPressable
      onPress={isPrev ? () => {} : onPress}
      accessibilityRole={isPrev ? 'none' : 'button'}
      accessibilityLabel={isPrev ? '' : isToday ? `Día ${day}, hoy` : event ? `Día ${day}, ${event.label}` : `Día ${day}`}
      style={{ width: cellSize, height: cellSize, padding: 3, borderRadius: 8, borderWidth: isToday ? 2 : 1, borderColor, backgroundColor: bgColor, justifyContent: 'flex-start', alignItems: 'flex-start' }}
    >
      {isToday ? (
        <View style={{ alignSelf: 'center', marginBottom: 1 }}>
          <View style={{ backgroundColor: TEAL, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 999 }}>
            <TwText style={{ fontFamily: 'Ubuntu Bold', fontSize: 7, color: '#fff', letterSpacing: 0.4 }}>HOY</TwText>
          </View>
        </View>
      ) : null}

      <TwText style={{ fontFamily: isToday || event ? 'Ubuntu Bold' : 'Ubuntu', fontSize: isPrev ? 10 : 11, lineHeight: 13, color: dayColor }}>
        {String(day).padStart(2, '0')}
      </TwText>

      {event ? (
        <View style={{ position: 'absolute', bottom: 4, left: 3, right: 3, height: 2, backgroundColor: event.accent === 'primary' ? TEAL_BRIGHT : PURPLE, borderRadius: 999 }} />
      ) : null}

      {isToday ? (
        <View style={{ position: 'absolute', bottom: 4, left: 0, right: 0, alignItems: 'center' }} pointerEvents="none">
          <View style={{ width: 4, height: 4, borderRadius: 999, backgroundColor: TEAL }} />
        </View>
      ) : null}
    </TwPressable>
  );
}

export function CalendarScreen() {
  const { isDark } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const gridWidth = screenWidth - SCREEN_H_PAD * 2 - CARD_PAD * 2;
  const cellSize = Math.floor((gridWidth - CELL_GAP * 6) / 7);

  const bg = isDark ? '#12131a' : '#f8f9fa';
  const cardBg = isDark ? 'rgba(26,27,34,0.9)' : 'rgba(255,255,255,0.82)';
  const cardBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.6)';
  const cardShadow = isDark ? '0 8px 32px rgba(0,0,0,0.25)' : '0 8px 32px rgba(0,0,0,0.05)';
  const textPrimary = isDark ? '#f8f9fa' : '#1a1b22';
  const textSecondary = '#5c6370';

  return (
    <TwView className="flex-1" style={{ backgroundColor: bg }}>
      <TopAppBar title="Finnit" />

      <TwScrollView className="flex-1" contentContainerClassName="pb-28" contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false}>

        {/* Header */}
        <Animated.View entering={FadeInUp.duration(350)} style={{ paddingHorizontal: SCREEN_H_PAD, paddingTop: 24, paddingBottom: 20 }}>
          <TwText style={{ fontFamily: 'Ubuntu Bold', fontSize: 32, lineHeight: 40, color: TEAL, marginBottom: 6 }}>
            Calendario de Pagos
          </TwText>
          <TwText style={{ fontFamily: 'Ubuntu', fontSize: 15, lineHeight: 22, color: textSecondary }}>
            Gestiona tus vencimientos y proyecta tu salud financiera.
          </TwText>
        </Animated.View>

        {/* Calendar Card */}
        <Animated.View entering={FadeInUp.duration(380).delay(80)} style={{ paddingHorizontal: SCREEN_H_PAD, marginBottom: 12 }}>
          <TwView style={{ backgroundColor: cardBg, borderWidth: 1, borderColor: cardBorder, borderRadius: 20, padding: CARD_PAD, boxShadow: cardShadow }}>

            {/* Month navigation + view toggle */}
            <TwView style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <TwView style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <TwPressable onPress={() => {}} accessibilityRole="button" accessibilityLabel="Mes anterior" style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18 }}>
                  <SymbolView name="chevron.left" size={15} tintColor={textSecondary} accessibilityLabel="" />
                </TwPressable>
                <TwText style={{ fontFamily: 'Ubuntu Bold', fontSize: 17, color: textPrimary }}>Octubre 2023</TwText>
                <TwPressable onPress={() => {}} accessibilityRole="button" accessibilityLabel="Mes siguiente" style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18 }}>
                  <SymbolView name="chevron.right" size={15} tintColor={textSecondary} accessibilityLabel="" />
                </TwPressable>
              </TwView>

              <TwView style={{ flexDirection: 'row', gap: 4 }}>
                {(['month', 'week'] as const).map((mode) => {
                  const label = mode === 'month' ? 'MES' : 'SEMANA';
                  const isActive = viewMode === mode;
                  return (
                    <TwPressable
                      key={mode}
                      onPress={() => setViewMode(mode)}
                      accessibilityRole="button"
                      accessibilityLabel={mode === 'month' ? 'Vista mensual' : 'Vista semanal'}
                      accessibilityState={{ selected: isActive }}
                      style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: isActive ? 'rgba(0,105,110,0.12)' : 'transparent', minHeight: 32, justifyContent: 'center' }}
                    >
                      <TwText style={{ fontFamily: isActive ? 'Ubuntu Bold' : 'Ubuntu Medium', fontSize: 11, letterSpacing: 0.5, color: isActive ? TEAL : textSecondary }}>
                        {label}
                      </TwText>
                    </TwPressable>
                  );
                })}
              </TwView>
            </TwView>

            {/* Day-of-week headers */}
            <TwView style={{ flexDirection: 'row', gap: CELL_GAP, marginBottom: 4 }}>
              {DAY_HEADERS.map((header, i) => (
                <TwView key={header} style={{ width: cellSize, alignItems: 'center', paddingVertical: 3 }}>
                  <TwText style={{ fontFamily: 'Ubuntu Medium', fontSize: 9, letterSpacing: 0.5, color: i >= 5 ? 'rgba(0,105,110,0.5)' : '#9ba0a8' }}>
                    {header}
                  </TwText>
                </TwView>
              ))}
            </TwView>

            {/* Calendar grid */}
            <TwView style={{ flexDirection: 'row', flexWrap: 'wrap', gap: CELL_GAP }}>
              {CALENDAR_CELLS.map((cell, index) => (
                <DayCell
                  key={`${cell.kind}-${index}`}
                  cell={cell}
                  cellSize={cellSize}
                  isSelected={cell.kind === 'current' && cell.day === selectedDay}
                  onPress={() => setSelectedDay(cell.kind === 'current' ? cell.day : null)}
                  isDark={isDark}
                />
              ))}
            </TwView>
          </TwView>
        </Animated.View>

        {/* Monthly Projections */}
        <TwView style={{ flexDirection: 'row', gap: 10, paddingHorizontal: SCREEN_H_PAD, marginBottom: 24 }}>
          <Animated.View entering={FadeInUp.duration(350).delay(160)} style={{ flex: 1 }}>
            <TwView style={{ backgroundColor: isDark ? 'rgba(0,245,255,0.06)' : 'rgba(0,245,255,0.10)', borderWidth: 1, borderColor: isDark ? 'rgba(0,245,255,0.15)' : 'rgba(0,105,110,0.18)', borderRadius: 20, padding: 14, boxShadow: cardShadow }}>
              <TwView style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <TwView style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                  <SymbolView name="chart.line.uptrend.xyaxis" size={16} tintColor={TEAL} accessibilityLabel="" />
                </TwView>
                <TwText style={{ fontFamily: 'Ubuntu Bold', fontSize: 8, color: TEAL, letterSpacing: 0.7, textAlign: 'right', flexShrink: 1, marginLeft: 4 }}>
                  AHORRO{'\n'}PROYECTADO
                </TwText>
              </TwView>
              <TwText style={{ fontFamily: 'Ubuntu Bold', fontSize: 20, color: textPrimary, marginBottom: 10 }}>$2,450.00</TwText>
              <TwView style={{ height: 5, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 999, overflow: 'hidden', marginBottom: 5 }}>
                <TwView style={{ width: '75%', height: '100%', backgroundColor: TEAL, borderRadius: 999, boxShadow: `0 0 8px ${TEAL_BRIGHT}` }} />
              </TwView>
              <TwText style={{ fontFamily: 'Ubuntu', fontSize: 10, color: textSecondary, lineHeight: 14 }}>75% de tu meta mensual</TwText>
            </TwView>
          </Animated.View>

          <Animated.View entering={FadeInUp.duration(350).delay(240)} style={{ flex: 1 }}>
            <TwView style={{ backgroundColor: isDark ? 'rgba(108,114,203,0.08)' : 'rgba(108,114,203,0.07)', borderWidth: 1, borderColor: 'rgba(108,114,203,0.2)', borderRadius: 20, padding: 14, boxShadow: cardShadow }}>
              <TwView style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <TwView style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                  <SymbolView name="building.columns.fill" size={16} tintColor={PURPLE} accessibilityLabel="" />
                </TwView>
                <TwText style={{ fontFamily: 'Ubuntu Bold', fontSize: 8, color: PURPLE, letterSpacing: 0.7, textAlign: 'right', flexShrink: 1, marginLeft: 4 }}>
                  GASTOS{'\n'}FIJOS
                </TwText>
              </TwView>
              <TwText style={{ fontFamily: 'Ubuntu Bold', fontSize: 20, color: textPrimary, marginBottom: 10 }}>$1,120.40</TwText>
              <TwView style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <SymbolView name="arrow.down" size={11} tintColor="#22c55e" accessibilityLabel="" />
                <TwText style={{ fontFamily: 'Ubuntu', fontSize: 10, color: textSecondary, lineHeight: 14 }}>5% menos que el mes pasado</TwText>
              </TwView>
            </TwView>
          </Animated.View>
        </TwView>

        {/* Upcoming Payments */}
        <Animated.View entering={FadeInUp.duration(350).delay(300)} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SCREEN_H_PAD, marginBottom: 10 }}>
          <TwText style={{ fontFamily: 'Ubuntu Bold', fontSize: 20, color: textPrimary }}>Próximos Pagos</TwText>
          <TwPressable onPress={() => {}} accessibilityRole="button" accessibilityLabel="Filtrar pagos" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <SymbolView name="line.3.horizontal.decrease" size={20} tintColor={TEAL} accessibilityLabel="" />
          </TwPressable>
        </Animated.View>

        <TwView style={{ paddingHorizontal: SCREEN_H_PAD, gap: 8, marginBottom: 16 }}>
          <PaymentItem title="Alquiler Octubre" amount="$850.00" status="pending" timeLabel="Hace 2 días" symbolName="house.fill" iconBg={TEAL} iconTint="#fff" animationDelay={360} />
          <PaymentItem title="Seguro Médico" amount="$120.00" status="scheduled" timeLabel="En 3 días" symbolName="cross.case.fill" iconBg={PURPLE} iconTint="#fff" animationDelay={420} />
          <PaymentItem title="Servicio Eléctrico" amount="$45.50" status="paid" timeLabel="Ayer" symbolName="bolt.fill" iconBg="rgba(0,0,0,0.08)" iconTint="#5c6370" animationDelay={480} />
        </TwView>

        {/* Add payment CTA */}
        <Animated.View entering={FadeInUp.duration(350).delay(540)} style={{ paddingHorizontal: SCREEN_H_PAD, marginBottom: 16 }}>
          <TwView style={{ borderWidth: 2, borderStyle: 'dashed', borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)', borderRadius: 16, paddingVertical: 28, paddingHorizontal: 24, alignItems: 'center', gap: 8 }}>
            <SymbolView name="creditcard.fill" size={30} tintColor={isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)'} accessibilityLabel="" />
            <TwText style={{ fontFamily: 'Ubuntu Bold', fontSize: 15, color: '#9ba0a8', textAlign: 'center' }}>¿Nuevo gasto recurrente?</TwText>
            <TwPressable onPress={() => {}} accessibilityRole="button" accessibilityLabel="Agregar nuevo pago recurrente" style={{ marginTop: 4, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 999, backgroundColor: TEAL, minHeight: 44, justifyContent: 'center', boxShadow: `0 0 18px ${TEAL_BRIGHT}80` }}>
              <TwText style={{ fontFamily: 'Ubuntu Bold', fontSize: 14, color: '#fff' }}>Agregar Pago</TwText>
            </TwPressable>
          </TwView>
        </Animated.View>

        {/* Finnit AI Tip */}
        <Animated.View entering={FadeInUp.duration(350).delay(620)} style={{ paddingHorizontal: SCREEN_H_PAD }}>
          <TwView style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)', borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', borderRadius: 14, padding: 14 }}>
            <TwView style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <SymbolView name="sparkles" size={15} tintColor={TEAL} accessibilityLabel="" />
              <TwText style={{ fontFamily: 'Ubuntu Bold', fontSize: 13, color: textPrimary }}>Consejo Finnit AI</TwText>
            </TwView>
            <TwText style={{ fontFamily: 'Ubuntu', fontSize: 12, lineHeight: 18, color: textSecondary }}>
              Detectamos que tus suscripciones digitales han subido un 12%. Podrías ahorrar $15/mes cancelando servicios que no has usado en 30 días.
            </TwText>
          </TwView>
        </Animated.View>
      </TwScrollView>

    </TwView>
  );
}
