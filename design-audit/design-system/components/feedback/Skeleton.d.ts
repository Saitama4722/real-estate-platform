export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  radius?: number;
  style?: object;
}
export declare function Skeleton(props: SkeletonProps): JSX.Element;
export interface PropertyCardSkeletonProps { style?: object }
/** Скелетон карточки объекта; геометрия совпадает с PropertyCard, чтобы не было скачка. */
export declare function PropertyCardSkeleton(props: PropertyCardSkeletonProps): JSX.Element;
