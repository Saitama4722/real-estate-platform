import Link from "next/link";
import { Container } from "@/components/layout/container";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-gray-200 bg-white mt-auto">
      <Container>
        <div className="flex items-center justify-between py-6 text-sm text-gray-500">
          <p>© {year} Centreal. Краснодарский край.</p>
          <nav aria-label="Навигация в подвале">
            <ul className="flex items-center gap-4">
              <li>
                <Link
                  href="/catalog"
                  className="hover:text-gray-700 transition-colors"
                >
                  Купить
                </Link>
              </li>
              <li>
                <Link
                  href="/articles"
                  className="hover:text-gray-700 transition-colors"
                >
                  Статьи
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="hover:text-gray-700 transition-colors"
                >
                  Политика конфиденциальности
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="hover:text-gray-700 transition-colors"
                >
                  Пользовательское соглашение
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </Container>
    </footer>
  );
}
