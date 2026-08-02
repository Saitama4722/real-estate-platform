"use client";

import { useId } from "react";
import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";

/**
 * 152-ФЗ personal-data consent checkbox for public forms that collect a name,
 * a phone number and free-text.
 *
 * ⚠ SHARED ON PURPOSE. Both public data-collecting forms use this one component
 * (`PublicLeadInquiryForm`, which is itself shared by the homepage card, the
 * property-detail modal and the realtor contact modal, and `SellPropertyForm`).
 * Consent wording and the policy link are a legal surface — if they are
 * duplicated per form they WILL drift, which is exactly the multi-render-site
 * problem that has bitten article and property cards in this codebase before.
 * Change the wording here and every form changes with it.
 *
 * Requirements this encodes:
 *   • unchecked by default — the caller owns the state and must initialise false;
 *   • the consent is explicit and specific, and links to the policy;
 *   • it does NOT claim the data is unstored. It IS stored, for the realtor to
 *     act on — see the policy's §2/§5/§7. Never add a "мы ничего не храним"
 *     reassurance here; it would be false and worse than saying nothing.
 */

/** Single source of truth for the validation message, so both forms match. */
export const CONSENT_REQUIRED_ERROR =
  "Необходимо согласие на обработку персональных данных.";

export interface ConsentCheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Inline validation message; rendered under the checkbox when present. */
  error?: string;
}

export function ConsentCheckbox({
  checked,
  onCheckedChange,
  disabled,
  error,
}: ConsentCheckboxProps) {
  // useId keeps label/input wiring correct even when two forms are mounted on
  // the same page (e.g. a page-level card plus an open modal).
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div>
      <Checkbox
        id={id}
        alignTop
        wrapperClassName="gap-[11px]"
        className="ctr-check"
        labelClassName="text-[13px] leading-[1.5] text-fg-muted text-pretty"
        checked={checked}
        onChange={(e) => onCheckedChange(e.target.checked)}
        disabled={disabled}
        required
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        label={
          <>
            Я даю согласие на обработку моих персональных данных в соответствии
            с{" "}
            <Link
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              /* Opens in a NEW TAB deliberately: these forms live in modals and
                 navigating away would discard everything already typed. */
              className="text-brand no-underline shadow-[inset_0_-1px_0_rgba(26,95,224,.35)] hover:text-brand-hover"
              /* The link sits inside the <label>, so without this a click would
                 be forwarded to the checkbox and silently toggle consent while
                 the policy opens in the other tab. */
              onClick={(e) => e.stopPropagation()}
            >
              Политикой обработки персональных данных
            </Link>
          </>
        }
      />
      {error && (
        <p id={errorId} className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
