export interface InputProps {
  label?: string;
  placeholder?: string;
  /** текст ошибки; окрашивает поле в --color-danger (НЕ акцентный красный) */
  error?: string;
  hint?: string;
  /** иконка Lucide слева, напр. "search" */
  icon?: string;
  value?: string;
  onChange?: (e: any) => void;
  type?: string;
  disabled?: boolean;
  name?: string;
  style?: object;
}
export declare function Input(props: InputProps): JSX.Element;
