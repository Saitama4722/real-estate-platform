import { Icon, Icons } from "@/components/ui/icon";
import { formatPhoneParens, telHref } from "@/lib/phoneFormat";

/**
 * The agency phone in the site header.
 *
 * SERVER COMPONENT on purpose — `Header` awaits the value and passes it in, so
 * the number is in the SSR markup and there is no post-hydration insertion and
 * therefore no layout shift. Nothing here reads `window`, so it costs no client
 * bundle.
 *
 * ⚠ It returns `null` for an empty value, and every CALL SITE must place the
 * conditional on the wrapper element (the `<li>` / `<div>`), not rely on this
 * null alone — a rendered-but-empty flex child would still consume the row's
 * `gap`. Clearing the phone must leave no trace.
 */
export function HeaderPhone({
  phone,
  variant,
}: {
  phone: string;
  /** `full` = icon + formatted number. `icon` = 44px tap target only. */
  variant: "full" | "icon";
}) {
  const value = (phone || "").trim();
  if (!value) return null;

  const pretty = formatPhoneParens(value);

  if (variant === "icon") {
    return (
      <a
        href={telHref(value)}
        aria-label={`Позвонить: ${pretty}`}
        title={pretty}
        className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-brand transition-colors duration-150 hover:bg-brand-tint focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgba(26,95,224,0.25)]"
      >
        <Icon icon={Icons.Phone} size={20} />
      </a>
    );
  }

  return (
    <a
      href={telHref(value)}
      aria-label={`Позвонить: ${pretty}`}
      /*
       * Brand blue + 600 weight makes it read as a contact, not a nav link —
       * but it stays TEXT on the header's own background. The «Продать
       * недвижимость» CTA next to it is the only filled button in the row, so
       * it remains unmistakably the primary action.
       */
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1.5 text-[15px] font-semibold leading-none tracking-[-0.01em] text-brand transition-colors duration-150 hover:bg-brand-tint focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgba(26,95,224,0.25)]"
    >
      <Icon icon={Icons.Phone} size={16} className="shrink-0" />
      {pretty}
    </a>
  );
}
