import type { Metadata } from "next";
import { CompareView } from "@/components/compare/CompareView";

export const metadata: Metadata = {
  title: "Сравнение объектов — Centreal",
  description: "Сравнение объектов недвижимости по характеристикам.",
  // Personal, client-side selection — nothing here to index.
  robots: { index: false, follow: true },
};

export default function ComparePage() {
  return <CompareView />;
}
