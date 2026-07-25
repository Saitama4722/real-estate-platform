import type { Metadata } from "next";
import { FavoritesView } from "@/components/favorites/FavoritesView";

export const metadata: Metadata = {
  title: "Избранное — Centreal",
  description: "Сохранённые объекты недвижимости.",
  // Personal, client-side list — nothing here to index.
  robots: { index: false, follow: true },
};

export default function FavoritesPage() {
  return <FavoritesView />;
}
