import Link from "next/link";
import { HeaderAccountControls } from "@/components/layout/header-account-controls";
import { Container } from "@/components/layout/container";

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
            <HeaderAccountControls />
          </div>
        </div>
      </Container>
    </header>
  );
}
