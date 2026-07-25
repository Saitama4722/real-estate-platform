export interface IconProps {
  /** kebab-имя иконки Lucide, напр. "heart", "map-pin", "sliders-horizontal" */
  name: string;
  /** 16 — в тексте и спеках карточки; 20 — кнопки и навигация (по умолчанию); 24 — крупные действия; 28 — категории */
  size?: number;
  strokeWidth?: number;
  color?: string;
  style?: object;
  className?: string;
}
export declare function Icon(props: IconProps): JSX.Element;
