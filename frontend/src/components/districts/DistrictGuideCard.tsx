import Link from "next/link";
import type { PublicDistrictGuide } from "@/lib/publicDistrictGuides";
import { isPropertyImageUrl } from "@/lib/propertyMedia";

interface DistrictGuideCardProps {
  guide: PublicDistrictGuide;
}

export function DistrictGuideCard({ guide }: DistrictGuideCardProps) {
  const href = `/districts/${guide.slug}`;
  // Optional-image pattern (mirrors ArticlePreviewCard): render the image block
  // ONLY when a real cover is set — no gray/placeholder box when it's absent.
  const hasCover = Boolean(guide.coverImage && isPropertyImageUrl(guide.coverImage));

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white">
      {hasCover && (
        <div className="aspect-[16/10] w-full bg-gray-200">
          <img
            src={guide.coverImage as string}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        </div>
      )}
      <div className="flex flex-1 flex-col p-5">
        <h2 className="line-clamp-2 text-base font-semibold text-gray-900">
          <Link href={href} className="hover:text-gray-700">
            {guide.title}
          </Link>
        </h2>
        <p className="mt-2 line-clamp-3 flex-1 text-sm text-gray-700">{guide.excerpt}</p>
        <div className="mt-4 pt-2">
          <Link
            href={href}
            className="text-sm font-medium text-gray-900 underline underline-offset-2 hover:text-gray-700"
          >
            Читать гид
          </Link>
        </div>
      </div>
    </article>
  );
}
