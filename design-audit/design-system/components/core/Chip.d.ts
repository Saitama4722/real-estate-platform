export interface ChipProps {
  children?: any;
  /** активный фильтр — синяя заливка */
  active?: boolean;
  /** показать крестик сброса */
  removable?: boolean;
  icon?: string;
  onClick?: () => void;
  onRemove?: () => void;
}
export declare function Chip(props: ChipProps): JSX.Element;
