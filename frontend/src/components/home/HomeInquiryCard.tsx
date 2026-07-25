"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import { PublicLeadInquiryForm } from "@/components/inquiry/PublicLeadInquiryForm";
import { HomepageInlineText } from "@/components/home/HomepageInlineText";
import type { HomepageTextMap } from "@/lib/homepageTextBlocks";

type HomeInquiryCopy = Pick<
  HomepageTextMap,
  | "inquiry_section_title"
  | "inquiry_section_subtitle"
  | "inquiry_button_label"
  | "inquiry_modal_title"
  | "inquiry_modal_subtitle"
>;

/**
 * The design's `.ask` card — «Остались вопросы?».
 *
 * Was `HomeInquirySection`: a full-width light band sitting immediately after
 * the hero. In the design it is not a section at all, it is the RIGHT COLUMN of
 * the «Недвижимость в Краснодарском крае» section (`.seo{grid-template-columns:
 * 1.6fr 1fr}`), so it is now a card rendered into that column by
 * `SeoTextSection`'s `aside` prop.
 *
 * The CMS block keys are unchanged, so existing homepage copy carries over
 * untouched — only the heading LEVEL changed (h2 → h3), which is correct now
 * that it sits inside another section's heading scope rather than owning one.
 */
export function HomeInquiryCard({ text }: { text: HomeInquiryCopy }) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  return (
    <>
      {/* 22px padding mobile → 28px desktop; radius-md + shadow-sm, i.e. the
          same surface language as every other card on the page. */}
      <div className="rounded-xl bg-surface-raised p-[22px] shadow-sm md:p-7">
        <HomepageInlineText
          blockKey="inquiry_section_title"
          value={text.inquiry_section_title}
          as="h3"
          className="text-h3 text-fg"
        />
        <HomepageInlineText
          blockKey="inquiry_section_subtitle"
          value={text.inquiry_section_subtitle}
          as="p"
          className="mt-2 text-[13px] leading-[19px] text-fg-secondary md:text-small"
        />
        {/* `secondary` (blue tint on blue-700), per the kit's
            `ctr-btn--secondary` — it was an `outline` button before. */}
        <Button
          type="button"
          variant="secondary"
          icon={Icons.Message}
          className="mt-3.5 md:mt-[18px]"
          onClick={() => {
            setFormKey((k) => k + 1);
            setOpen(true);
          }}
        >
          <HomepageInlineText
            blockKey="inquiry_button_label"
            value={text.inquiry_button_label}
            as="span"
            className="font-medium"
            editTrigger="doubleClick"
          />
        </Button>
      </div>

      <Modal isOpen={open} onClose={() => setOpen(false)}>
        <HomepageInlineText
          blockKey="inquiry_modal_title"
          value={text.inquiry_modal_title}
          as="h2"
          className="text-h3 text-fg"
        />
        <HomepageInlineText
          blockKey="inquiry_modal_subtitle"
          value={text.inquiry_modal_subtitle}
          as="p"
          className="mt-1 text-small text-fg-secondary"
        />
        <PublicLeadInquiryForm key={formKey} />
      </Modal>
    </>
  );
}
