Скелетоны загрузки: shimmer 1.4s linear, отключается при prefers-reduced-motion.

```jsx
{loading ? <PropertyCardSkeleton /> : <PropertyCard {...item} />}
<Skeleton width="60%" height={12} />
```

Показывать только если данные идут дольше 200 мс.
