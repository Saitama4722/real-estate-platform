import React from 'react';
import { injectTheme } from '../core/Theme.jsx';
import { Icon } from '../core/Icon.jsx';
export function Input({ label, hint, error, icon, placeholder, value, onChange, type = 'text', disabled = false, name, style }) {
  injectTheme();
  const input = React.createElement('input', { className: 'ctr-input' + (error ? ' is-error' : ''), type: type, placeholder: placeholder,
    value: value, onChange: onChange, disabled: disabled, name: name, 'aria-invalid': !!error });
  return React.createElement('label', { className: 'ctr-field', style: style },
    label ? React.createElement('span', { className: 'ctr-field__label' }, label) : null,
    icon ? React.createElement('span', { className: 'ctr-inputwrap' }, React.createElement(Icon, { name: icon, size: 18 }), input) : input,
    error ? React.createElement('span', { className: 'ctr-field__error' }, React.createElement(Icon, { name: 'circle-alert', size: 13 }), error)
          : hint ? React.createElement('span', { className: 'ctr-field__hint' }, hint) : null);
}
