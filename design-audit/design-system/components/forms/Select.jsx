import React from 'react';
import { injectTheme } from '../core/Theme.jsx';
import { Icon } from '../core/Icon.jsx';
/** options: массив строк или {value, label} */
export function Select({ label, options = [], value, onChange, error, hint, disabled = false, name, style }) {
  injectTheme();
  const opts = options.map(function (o, i) {
    const v = typeof o === 'string' ? o : o.value, l = typeof o === 'string' ? o : o.label;
    return React.createElement('option', { key: i, value: v }, l);
  });
  return React.createElement('label', { className: 'ctr-field', style: style },
    label ? React.createElement('span', { className: 'ctr-field__label' }, label) : null,
    React.createElement('span', { className: 'ctr-selectwrap' },
      React.createElement('select', { className: 'ctr-select' + (error ? ' is-error' : ''), value: value, onChange: onChange, disabled: disabled, name: name, 'aria-invalid': !!error }, opts)),
    error ? React.createElement('span', { className: 'ctr-field__error' }, React.createElement(Icon, { name: 'circle-alert', size: 13 }), error)
          : hint ? React.createElement('span', { className: 'ctr-field__hint' }, hint) : null);
}
