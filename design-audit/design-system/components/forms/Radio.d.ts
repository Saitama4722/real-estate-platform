export interface RadioProps {
  label?: string;
  checked?: boolean;
  onChange?: (e: any) => void;
  disabled?: boolean;
  error?: boolean;
  name?: string;
  value?: string;
}
export declare function Radio(props: RadioProps): JSX.Element;
