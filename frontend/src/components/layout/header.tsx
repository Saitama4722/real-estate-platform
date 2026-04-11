import Link from "next/link";
import { Container } from "@/components/layout/container";
import { cn } from "@/lib/utils";

const navLinks = [
  { label: "Купить", href: "/catalog" },
  { label: "Статьи", href: "/articles" },
];

export function Header() {
  return (
    <header className="border-b border-gray-200 bg-white">
      <Container>
        <div className="flex items-center justify-between h-16">
          <Link
            href="/"
            className="text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors"
          >
            Centreal
          </Link>
          <div className="flex items-center gap-6">
            <nav aria-label="Основная навигация">
              <ul className="flex items-center gap-6">
                {navLinks.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <Link
              href="/account/login"
              className={cn(
                "inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-900 transition-colors",
                "hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1",
              )}
            >
              Вход в личный кабинет
            </Link>
          </div>
        </div>
      </Container>
    </header>
  );
}
