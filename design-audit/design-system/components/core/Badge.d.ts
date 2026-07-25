export interface BadgeProps {
  /** 'accent' — «Цена снижена»/горячее; 'primary' — «Новый объект»; 'neutral'; 'success' */
  variant?: string;
  children?: any;
}
export declare function Badge(props: BadgeProps): JSX.Element;
