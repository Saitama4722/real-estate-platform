"use client";

import { useState } from "react";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
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

export function HomeInquirySection({ text }: { text: HomeInquiryCopy }) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  return (
    <section className="border-b border-gray-100 bg-gray-50/80 py-8">
      <Container className="flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
        <div>
          <HomepageInlineText
            blockKey="inquiry_section_title"
            value={text.inquiry_section_title}
            as="h2"
            className="text-lg font-semibold text-gray-900"
          />
          <HomepageInlineText
            blockKey="inquiry_section_subtitle"
            value={text.inquiry_section_subtitle}
            as="p"
            className="mt-1 text-sm text-gray-600"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          className="shrink-0 border-gray-300 bg-white"
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
      </Container>

      <Modal isOpen={open} onClose={() => setOpen(false)}>
        <HomepageInlineText
          blockKey="inquiry_modal_title"
          value={text.inquiry_modal_title}
          as="h2"
          className="text-lg font-semibold text-gray-900"
        />
        <HomepageInlineText
          blockKey="inquiry_modal_subtitle"
          value={text.inquiry_modal_subtitle}
          as="p"
          className="mt-1 text-sm text-gray-600"
        />
        <PublicLeadInquiryForm key={formKey} />
      </Modal>
    </section>
  );
}
