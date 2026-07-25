/** @startingPoint section="Компоненты" subtitle="Шапка: десктоп и мобильная с бургер-меню" viewport="1440x100" */
export interface HeaderProps {
  /** подсвеченный пункт: 'Каталог' | 'Районы' | 'Статьи' | 'Избранное' | 'Сравнение' */
  active?: string;
  /** мобильный вариант (390px) с бургером */
  mobile?: boolean;
  menuOpen?: boolean;
  onMenuToggle?: () => void;
}
export declare function Header(props: HeaderProps): JSX.Element;
