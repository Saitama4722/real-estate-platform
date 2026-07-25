/** @startingPoint section="Компоненты" subtitle="Панель поиска: продажа/аренда, фильтры" viewport="1000x360" */
export interface SearchBarProps {
  /** мобильная раскладка в одну колонку */
  stacked?: boolean;
  onSubmit?: () => void;
  onMap?: () => void;
}
export declare function SearchBar(props: SearchBarProps): JSX.Element;
