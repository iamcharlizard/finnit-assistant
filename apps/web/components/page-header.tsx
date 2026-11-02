'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { TopAppBar } from '@finnit/ui/components/navigation/top-app-bar';
import { Button } from '@finnit/ui/components/ui/button';

import {
  HeaderChromeContext,
  PAGE_HEADER_CLASS,
} from '@/components/header-chrome';

/**
 * A screen's heading, drawn in the floating top bar (title as the page's
 * `<h1>`, subtitle and actions) so the title is not shown twice. Render it as
 * the first child of the screen's root element. With `back`, a button
 * before the title goes to the parent screen.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  back,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
}) {
  const chrome = React.useContext(HeaderChromeContext);
  return (
    <TopAppBar
      {...chrome}
      leading={
        back ? (
          <Button
            variant="ghost"
            size="icon"
            className="-ml-2 shrink-0"
            title={back.label}
            asChild
          >
            <Link href={back.href} aria-label={back.label}>
              <ArrowLeft aria-hidden />
            </Link>
          </Button>
        ) : undefined
      }
      title={title}
      titleAs="h1"
      subtitle={subtitle}
      actions={actions}
      className={PAGE_HEADER_CLASS}
    />
  );
}
