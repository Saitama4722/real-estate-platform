import React from 'react';
import { injectTheme } from '../core/Theme.jsx';
export function Radio({ label, checked, onChange, disabled = false, error = false, name, value }) {
  injectTheme();
  return React.createElement('label', { className: 'ctr-radio' + (disabled ? ' is-disabled' : '') },
    React.createElement('input', { type: 'radio', className: error ? 'is-error' : '', checked: checked, onChange: onChange, disabled: disabled, name: name, value: value }),
    React.createElement('span', null, label));
}
