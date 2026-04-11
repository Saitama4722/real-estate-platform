"use client";

import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

interface DuplicateCandidate {
  id: number;
  title: string;
  price: string;
  location: string;
  status: string;
  score: number;
  reasons: string[];
}

interface DuplicateWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  likelyDuplicates: DuplicateCandidate[];
  suspicious: DuplicateCandidate[];
}

export function DuplicateWarningModal({
  isOpen,
  onClose,
  onConfirm,
  likelyDuplicates,
  suspicious,
}: DuplicateWarningModalProps) {
  const hasLikely = likelyDuplicates.length > 0;
  const hasSuspicious = suspicious.length > 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-3xl">
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">
          Обнаружены похожие объекты
        </h2>

        <p className="text-sm text-gray-700">
          В системе найдены объекты, похожие на создаваемый. Проверьте список и
          убедитесь, что вы не создаёте дубликат.
        </p>

        {hasLikely && (
          <div className="space-y-2">
            <h3 className="text-base font-semibold text-red-700">
              Вероятные дубликаты (≥80 баллов)
            </h3>
            <div className="space-y-2">
              {likelyDuplicates.map((dup) => (
                <div
                  key={dup.id}
                  className="rounded-md border border-red-200 bg-red-50 p-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {dup.title}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        {dup.price} • {dup.location}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Статус: {dup.status} • Совпадение: {dup.score} баллов
                      </p>
                      {dup.reasons.length > 0 && (
                        <ul className="mt-2 text-xs text-gray-600 list-disc list-inside">
                          {dup.reasons.slice(0, 3).map((reason, idx) => (
                            <li key={idx}>{reason}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {hasSuspicious && (
          <div className="space-y-2">
            <h3 className="text-base font-semibold text-yellow-700">
              Подозрительные совпадения (60–79 баллов)
            </h3>
            <div className="space-y-2">
              {suspicious.map((dup) => (
                <div
                  key={dup.id}
                  className="rounded-md border border-yellow-200 bg-yellow-50 p-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {dup.title}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        {dup.price} • {dup.location}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Статус: {dup.status} • Совпадение: {dup.score} баллов
                      </p>
                      {dup.reasons.length > 0 && (
                        <ul className="mt-2 text-xs text-gray-600 list-disc list-inside">
                          {dup.reasons.slice(0, 3).map((reason, idx) => (
                            <li key={idx}>{reason}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Отменить
          </Button>
          <Button variant="primary" onClick={onConfirm}>
            Всё равно создать
          </Button>
        </div>
      </div>
    </Modal>
  );
}
