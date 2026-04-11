import Link from "next/link";
import { memo } from "react";
import { isPropertyImageUrl } from "@/lib/propertyMedia";

interface PropertyCardProps {
  slug?: string;
  image: string;
  price: string;
  title: string;
  characteristics?: string;
  location: string;
  href?: string;
}

const PRIMARY_LINK_CLASS =
  "inline-flex h-10 w-full items-center justify-center rounded-md border border-transparent bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1";

function PropertyCardComponent({
  slug,
  image,
  price,
  title,
  characteristics,
  location,
  href,
}: PropertyCardProps) {
  const targetHref = href ?? (slug ? `/catalog/${slug}` : "/catalog");

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="aspect-[16/10] w-full bg-gray-200">
        {isPropertyImageUrl(image) ? (
          <img
            src={image}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-gray-500">{image}</div>
        )}
      </div>
      <div className="flex h-full flex-col p-4">
        <p className="text-xl font-semibold text-gray-900">{price}</p>
        <h3 className="mt-1 line-clamp-2 text-base font-medium text-gray-900">{title}</h3>
        {characteristics && (
          <p className="mt-2 text-sm text-gray-700">{characteristics}</p>
        )}
        <p className="mt-2 text-sm text-gray-500">{location}</p>

        <div className="mt-4 pt-2">
          <Link href={targetHref} className={PRIMARY_LINK_CLASS}>
            Открыть объект
          </Link>
        </div>
      </div>
    </article>
  );
}

export const PropertyCard = memo(PropertyCardComponent);
