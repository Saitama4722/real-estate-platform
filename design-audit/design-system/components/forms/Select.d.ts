export interface SelectProps {
  label?: string;
  options?: Array<string | { value: string; label: string }>;
  value?: string;
  onChange?: (e: any) => void;
  error?: string;
  hint?: string;
  disabled?: boolean;
  name?: string;
  style?: object;
}
export declare function Select(props: SelectProps): JSX.Element;
