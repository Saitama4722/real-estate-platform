"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { PublicLeadInquiryForm } from "@/components/inquiry/PublicLeadInquiryForm";

interface RealtorContactModalProps {
  /** Публичный CRM ID риэлтора (RID######) — лид привязывается к нему. */
  crmId: string;
  /** Отображаемое имя риэлтора для текста в модалке. */
  displayName: string;
}

/**
 * Кнопка «Связаться» + модалка с формой заявки. Тот же паттерн, что и в
 * `PropertyContactBlock.tsx`: `requestOpen` управляет модалкой, `formKey`
 * форс-ремаунтит `PublicLeadInquiryForm` при каждом открытии, чтобы форма
 * сбрасывалась (поля очищаются, капча перезагружается).
 */
export function RealtorContactModal({ crmId, displayName }: RealtorContactModalProps) {
  const [requestOpen, setRequestOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  return (
    <>
      <Button
        type="button"
        className="w-full sm:w-auto"
        onClick={() => {
          setFormKey((k) => k + 1);
          setRequestOpen(true);
        }}
      >
        Связаться
      </Button>

      <Modal isOpen={requestOpen} onClose={() => setRequestOpen(false)}>
        <h2 className="text-lg font-semibold text-gray-900">Связаться с риэлтором</h2>
        <p className="mt-1 text-sm text-gray-600">
          Оставьте заявку — {displayName} свяжется с вами и ответит на ваши вопросы.
        </p>
        <PublicLeadInquiryForm key={formKey} realtorCrmId={crmId} />
      </Modal>
    </>
  );
}
