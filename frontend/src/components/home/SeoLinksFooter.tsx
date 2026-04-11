import Link from "next/link";
import { Container } from "@/components/layout/container";

export interface SeoFooterLink {
  label: string;
  href: string;
}

interface SeoLinksFooterProps {
  links: SeoFooterLink[];
}

export function SeoLinksFooter({ links }: SeoLinksFooterProps) {
  return (
    <section className="border-t border-gray-200 bg-gray-50 py-8">
      <Container>
        <h2 className="text-lg font-semibold text-gray-900">Популярные запросы</h2>
        <ul className="mt-4 grid gap-2 text-sm text-gray-700 md:grid-cols-2">
          {links.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="hover:text-gray-900 hover:underline">
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
