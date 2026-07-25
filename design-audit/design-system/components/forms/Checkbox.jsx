import React from 'react';
import { injectTheme } from '../core/Theme.jsx';
export function Checkbox({ label, checked, onChange, disabled = false, error = false, name }) {
  injectTheme();
  return React.createElement('label', { className: 'ctr-check' + (disabled ? ' is-disabled' : '') },
    React.createElement('input', { type: 'checkbox', className: error ? 'is-error' : '', checked: checked, onChange: onChange, disabled: disabled, name: name }),
    React.createElement('span', null, label));
}
