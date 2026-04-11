"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { PublicLeadInquiryForm } from "@/components/inquiry/PublicLeadInquiryForm";

interface PropertyContactBlockProps {
  propertyId: number;
  realtorName?: string;
  realtorAvatar?: string;
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
      <Card className="sticky top-6">
        <CardHeader>
          <CardTitle>Связаться с агентом</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <RealtorAvatar name={displayName} avatar={realtorAvatar} />
            <div>
              <p className="text-xs text-gray-500">Риэлтор</p>
              <p className="text-sm font-medium text-gray-900">{displayName}</p>
            </div>
          </div>

          <div className="space-y-3">
            {phoneState.status === "hidden" && (
              <Button className="w-full" onClick={handleRevealPhone}>
                Показать телефон
              </Button>
            )}
            {phoneState.status === "loading" && (
              <Button className="w-full" disabled>
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
              variant="outline"
              className="w-full"
              onClick={() => {
                setFormKey((k) => k + 1);
                setRequestOpen(true);
              }}
            >
              Задать вопрос
            </Button>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <p className="text-xs text-gray-500">Объект #{propertyId}</p>
          </div>
        </CardContent>
      </Card>

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
