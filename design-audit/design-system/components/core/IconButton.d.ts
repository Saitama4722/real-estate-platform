export interface IconButtonProps {
  /** 'favorite' (сердце, актив — красный) | 'compare' (весы, актив — синий) */
  kind?: string;
  /** явная иконка Lucide вместо kind */
  icon?: string;
  active?: boolean;
  onClick?: () => void;
  /** aria-label, обязателен по смыслу: «В избранное», «Сравнить» */
  label?: string;
  size?: number;
  iconSize?: number;
}
export declare function IconButton(props: IconButtonProps): JSX.Element;
