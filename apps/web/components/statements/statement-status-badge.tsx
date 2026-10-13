import { Loader2 } from 'lucide-react';

import { Badge } from '@finnit/ui/components/ui/badge';

import type { StatementStatus } from '@/lib/statements/types';
import { STATUS_BADGE, isWorking } from '@/lib/statements/view';

/** uploaded / processing / needs_review / confirmed / failed. */
export function StatementStatusBadge({
  status,
  label,
}: {
  status: StatementStatus;
  label: string;
}) {
  return (
    <Badge variant={STATUS_BADGE[status]}>
      {isWorking(status) ? (
        <Loader2
          aria-hidden
          className="animate-spin motion-reduce:animate-none"
        />
      ) : null}
      {label}
    </Badge>
  );
}
