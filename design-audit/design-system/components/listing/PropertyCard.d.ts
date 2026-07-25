/** @startingPoint section="Компоненты" subtitle="Карточка объекта с избранным и сравнением" viewport="380x480" */
export interface PropertyCardProps {
  /** цена в рублях, число: 5000000 */
  price: number;
  /** старая цена при снижении — показывается зачёркнутой */
  oldPrice?: number;
  /** «1-комн. квартира» */
  rooms?: string;
  /** площадь в м²: 45 */
  area?: number | string;
  floor?: number;
  floorTotal?: number;
  /** «Краснодар, п. Северный» */
  address?: string;
  image?: string;
  /** красный бейдж «Цена снижена» */
  priceDrop?: boolean;
  /** синий бейдж «Новый объект» */
  isNew?: boolean;
  favorite?: boolean;
  compared?: boolean;
  onFavorite?: () => void;
  onCompare?: () => void;
  href?: string;
  style?: object;
}
export declare function PropertyCard(props: PropertyCardProps): JSX.Element;
