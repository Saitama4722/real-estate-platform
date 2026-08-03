"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, MessageCircle, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import { PublicLeadInquiryForm } from "@/components/inquiry/PublicLeadInquiryForm";

interface PropertyContactBlockProps {
  propertyId: number;
  realtorName?: string;
  realtorAvatar?: string;
  realtorCrmId?: string;
}

type PhoneState =
  | { status: "hidden" }
  | { status: "loading" }
  | { status: "revealed"; phone: string }
  | { status: "error"; message: string };

function RealtorAvatar({ name, avatar }: { name: string; avatar?: string }) {
  if (avatar) {
    return (
      <img
        src={avatar}
        alt={name}
        className="h-12 w-12 flex-shrink-0 rounded-full object-cover"
        loading="lazy"
        decoding="async"
      />
    );
  }

  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
      {initials}
    </div>
  );
}

export function PropertyContactBlock({
  propertyId,
  realtorName,
  realtorAvatar,
  realtorCrmId,
}: PropertyContactBlockProps) {
  const [phoneState, setPhoneState] = useState<PhoneState>({ status: "hidden" });
  const [requestOpen, setRequestOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const displayName = realtorName ?? "Агент Centreal";

  const handleRevealPhone = async () => {
    setPhoneState({ status: "loading" });
    try {
      const res = await fetch(`/api/properties/${propertyId}/reveal_phone/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.status === 429) {
        setPhoneState({
          status: "error",
          message: "Слишком много запросов. Попробуйте позже.",
        });
        return;
      }
      if (!res.ok) {
        setPhoneState({
          status: "error",
          message: "Телефон временно недоступен.",
        });
        return;
      }
      const data = await res.json();
      setPhoneState({ status: "revealed", phone: data.phone });
    } catch (e) {
      console.error("[PropertyContactBlock] reveal_phone", e);
      setPhoneState({
        status: "error",
        message: "Ошибка соединения. Попробуйте позже.",
      });
    }
  };

  return (
    <>
      {/* No card chrome and no «Связаться с агентом» heading: this block is the
          middle zone of the single unified sidebar card the reference shows —
          PropertyPriceCard supplies the panel, the dividers and the footer. */}
      <div>
        <div className="mb-4 flex items-center gap-3.5">
          <RealtorAvatar name={displayName} avatar={realtorAvatar} />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.08em] text-fg-muted uppercase">
              Риэлтор
            </p>
            <p className="mt-0.5 truncate text-[16.5px] font-semibold tracking-tight text-fg">
              {displayName}
            </p>
          </div>
        </div>

          <div className="space-y-2.5">
            {phoneState.status === "hidden" && (
              <Button size="lg" fullWidth icon={Phone} onClick={handleRevealPhone}>
                Показать телефон
              </Button>
            )}
            {phoneState.status === "loading" && (
              <Button size="lg" fullWidth disabled>
                Загрузка...
              </Button>
            )}
            {phoneState.status === "revealed" && (
              <div className="flex items-center justify-center rounded-md border border-blue-200 bg-blue-50 px-4 py-2.5">
                <span className="text-sm font-semibold text-blue-800">
                  {phoneState.phone}
                </span>
              </div>
            )}
            {phoneState.status === "error" && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2.5">
                <p className="text-sm text-red-700">{phoneState.message}</p>
                <button
                  type="button"
                  className="mt-1 text-xs text-red-500 underline"
                  onClick={() => setPhoneState({ status: "hidden" })}
                >
                  Попробовать снова
                </button>
              </div>
            )}

            <Button
              variant="neutral"
              size="lg"
              fullWidth
              icon={MessageCircle}
              onClick={() => {
                setFormKey((k) => k + 1);
                setRequestOpen(true);
              }}
            >
              Задать вопрос
            </Button>
            {realtorCrmId ? (
              <Link
                href={`/realtors/${encodeURIComponent(realtorCrmId)}`}
                className="flex items-center justify-center gap-1.5 pt-1.5 text-sm font-medium text-brand hover:text-brand-hover"
              >
                Страница риэлтора
                <Icon icon={ArrowUpRight} className="size-[14px]" />
              </Link>
            ) : null}
          </div>
      </div>

      <Modal isOpen={requestOpen} onClose={() => setRequestOpen(false)}>
        <h2 className="text-lg font-semibold text-gray-900">Задать вопрос</h2>
        <p className="mt-1 text-sm text-gray-600">
          Мы свяжемся с вами в ближайшее время и ответим на все вопросы по объекту.
        </p>
        <PublicLeadInquiryForm key={formKey} propertyId={propertyId} />
      </Modal>
    </>
  );
}
