export interface EmptyStateProps {
  /** иконка Lucide: 'heart' для избранного, 'scale' для сравнения, 'inbox' для заявок */
  icon?: string;
  title: string;
  text?: string;
  actionLabel?: string;
  actionIcon?: string;
  onAction?: () => void;
}
export declare function EmptyState(props: EmptyStateProps): JSX.Element;
