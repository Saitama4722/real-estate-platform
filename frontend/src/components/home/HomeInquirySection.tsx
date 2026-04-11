"use client";

import { useState } from "react";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { PublicLeadInquiryForm } from "@/components/inquiry/PublicLeadInquiryForm";

export function HomeInquirySection() {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  return (
    <section className="border-b border-gray-100 bg-gray-50/80 py-8">
      <Container className="flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Остались вопросы?
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Напишите нам — подскажем по каталогу и подбору объекта.
          </p>
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
          Задать вопрос
        </Button>
      </Container>

      <Modal isOpen={open} onClose={() => setOpen(false)}>
        <h2 className="text-lg font-semibold text-gray-900">Задать вопрос</h2>
        <p className="mt-1 text-sm text-gray-600">
          Оставьте контакты — мы перезвоним и ответим на ваш вопрос.
        </p>
        <PublicLeadInquiryForm key={formKey} />
      </Modal>
    </section>
  );
}
