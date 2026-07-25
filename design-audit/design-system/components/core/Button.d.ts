/** @startingPoint section="Компоненты" subtitle="Кнопки: primary/secondary/outline/ghost" viewport="700x400" */
export interface ButtonProps {
  /** 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' (только деструктив) | 'inverse' (на синем/тёмном фоне) */
  variant?: string;
  /** 'sm' 32px | 'md' 40px | 'lg' 48px */
  size?: string;
  /** kebab-имя иконки Lucide слева */
  icon?: string;
  iconRight?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  /** если задан — рендерится как <a> */
  href?: string;
  onClick?: () => void;
  type?: string;
  style?: object;
  children?: any;
}
export declare function Button(props: ButtonProps): JSX.Element;
