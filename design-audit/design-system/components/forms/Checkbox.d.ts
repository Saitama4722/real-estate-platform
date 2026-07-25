export interface CheckboxProps {
  label?: string;
  checked?: boolean;
  onChange?: (e: any) => void;
  disabled?: boolean;
  error?: boolean;
  name?: string;
}
export declare function Checkbox(props: CheckboxProps): JSX.Element;
