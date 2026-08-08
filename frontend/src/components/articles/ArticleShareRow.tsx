"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon, Icons } from "@/components/ui/icon";

/**
 * Share row under the article body: back-link to the index on the left,
 * Telegram / VK / copy-link pills on the right. Share targets are REAL
 * endpoints (t.me/share, vk.com/share.php) built from the canonical article
 * URL passed by the server — not location.href, so a ?utm-carrying visit
 * still shares the clean URL. Copy uses the same canonical and flips its
 * label to «Скопировано» for 2 s.
 */

interface ArticleShareRowProps {
  url: string;
  title: string;
}

const PILL_CLASS =
  "inline-flex h-10 items-center gap-[7px] rounded-full border border-border bg-surface-raised px-[15px] text-[13.5px] font-semibold text-fg-secondary transition-colors duration-[150ms] hover:border-gray-400 hover:text-fg focus-ring-brand";

export function ArticleShareRow({ url, title }: ArticleShareRowProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard denied (permissions/insecure context) — leave the label as
      // is; the reader still has the address bar.
    }
  };

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  return (
    <div className="mt-11 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6 font-sans">
      <Link
        href="/articles"
        className="inline-flex min-h-11 items-center gap-1.5 text-small font-semibold text-brand transition-colors duration-[150ms] hover:text-brand-hover focus-ring-brand"
      >
        <Icon icon={Icons.ArrowLeft} size={16} />
        Все статьи
      </Link>

      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[13px] text-fg-muted">Поделиться:</span>
        <a
          href={`https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`}
          target="_blank"
          rel="noopener noreferrer"
          className={PILL_CLASS}
        >
          <Icon icon={Icons.Send} size={16} className="h-3.5 w-3.5" />
          Telegram
        </a>
        <a
          href={`https://vk.com/share.php?url=${encodedUrl}`}
          target="_blank"
          rel="noopener noreferrer"
          className={PILL_CLASS}
        >
          <Icon icon={Icons.Share} size={16} className="h-3.5 w-3.5" />
          ВКонтакте
        </a>
        <button type="button" onClick={copy} className={PILL_CLASS}>
          <Icon icon={Icons.CopyLink} size={16} className="h-3.5 w-3.5" />
          {copied ? "Скопировано" : "Скопировать"}
        </button>
      </div>
    </div>
  );
}
