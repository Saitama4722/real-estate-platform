"use client";

import { useState } from "react";
import { Button, type ButtonSize } from "@/components/ui/button";
import { Icons, type IconName } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import { PublicLeadInquiryForm } from "@/components/inquiry/PublicLeadInquiryForm";

interface RealtorContactModalProps {
  /** Публичный CRM ID риэлтора (RID######) — лид привязывается к нему. */
  crmId: string;
  /** Отображаемое имя риэлтора для текста в модалке. */
  displayName: string;
  /**
   * Размер кнопки. По умолчанию `md` — как было до редизайна страницы.
   *
   * ⚠ Именно проп, а не className: `cn()` — обычная склейка, а не
   * tailwind-merge, поэтому `className="h-14"` не заменил бы `h-10`, обе
   * остались бы в списке классов и победил бы порядок в стилях. См. подробный
   * разбор в `ui/button-classes.ts`.
   */
  size?: ButtonSize;
  /**
   * Иконка перед подписью (в дизайне страницы — трубка).
   *
   * ⚠ ИМЯ иконки, а не сам компонент. Страница — серверный компонент, а Lucide
   * иконка это функция; передать её пропом через границу RSC нельзя —
   * «Functions cannot be passed directly to Client Components». Строка
   * сериализуется, а сам глиф резолвится здесь, уже на клиенте.
   */
  iconName?: IconName;
  /** Растянуть кнопку на всю ширину контейнера. */
  fullWidth?: boolean;
  /** Дополнительные классы кнопки (НЕ для размеров — см. `size`). */
  className?: string;
}

/**
 * Кнопка «Связаться» + модалка с формой заявки. Тот же паттерн, что и в
 * `PropertyContactBlock.tsx`: `requestOpen` управляет модалкой, `formKey`
 * форс-ремаунтит `PublicLeadInquiryForm` при каждом открытии, чтобы форма
 * сбрасывалась (поля очищаются, капча перезагружается).
 */
export function RealtorContactModal({
  crmId,
  displayName,
  size = "md",
  iconName,
  fullWidth = false,
  className = "w-full sm:w-auto",
}: RealtorContactModalProps) {
  const [requestOpen, setRequestOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  return (
    <>
      <Button
        type="button"
        size={size}
        icon={iconName ? Icons[iconName] : undefined}
        fullWidth={fullWidth}
        className={className}
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
