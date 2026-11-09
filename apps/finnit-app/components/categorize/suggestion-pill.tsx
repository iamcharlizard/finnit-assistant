import { useTranslations } from 'use-intl';
import { Check, X } from 'lucide-react-native';

import { TwView } from '@finnit/ui-native/lib/tw';
import { Button } from '@finnit/ui-native/components/ui/button';
import { Text } from '@finnit/ui-native/components/ui/text';

/** "Sugerencia: Restaurantes ✓ ✕" inside a row with a pending AI suggestion. */
export function SuggestionPill({
  label,
  busy,
  onAccept,
  onReject,
}: {
  label: string;
  busy: boolean;
  onAccept: () => void;
  onReject: () => void;
}) {
  const tc = useTranslations('categorize');
  return (
    <TwView className="flex-row items-center gap-2 rounded-full bg-primary-15 px-3 py-1">
      <Text weight="medium" numberOfLines={1} className="flex-1 text-xs">
        {tc('suggestion', { category: label })}
      </Text>
      <Button
        variant="ghost"
        size="icon-xs"
        icon={Check}
        disabled={busy}
        label={tc('acceptSuggestion', { category: label })}
        onPress={onAccept}
      />
      <Button
        variant="ghost"
        size="icon-xs"
        icon={X}
        disabled={busy}
        label={tc('rejectSuggestion', { category: label })}
        onPress={onReject}
      />
    </TwView>
  );
}
