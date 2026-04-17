import Link from "next/link";
import { Container } from "@/components/layout/container";
import { HomepageInlineText } from "@/components/home/HomepageInlineText";

interface Category {
  id: string;
  label: string;
  description: string;
  href: string;
}

interface CategoriesSectionProps {
  categories: Category[];
  sectionTitle: string;
}

export function CategoriesSection({ categories, sectionTitle }: CategoriesSectionProps) {
  return (
    <section className="py-10 md:py-12">
      <Container>
        <HomepageInlineText
          blockKey="categories_section_title"
          value={sectionTitle}
          as="h2"
          className="text-2xl font-semibold text-gray-900"
        />
        <div className="mt-5 grid grid-cols-2 gap-3 md:mt-6 md:grid-cols-4">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={category.href}
              className="rounded-xl border border-gray-200 bg-white p-4 text-left transition-colors hover:border-gray-300 hover:bg-gray-50"
            >
              <p className="text-base font-semibold text-gray-900">{category.label}</p>
              <p className="mt-1 text-sm text-gray-500">{category.description}</p>
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}
