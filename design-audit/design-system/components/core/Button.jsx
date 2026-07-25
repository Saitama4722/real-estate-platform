import React from 'react';
import { injectTheme } from './Theme.jsx';
import { Icon } from './Icon.jsx';
export function Button({ variant = 'primary', size = 'md', icon, iconRight, disabled = false, fullWidth = false, href, onClick, type = 'button', style, children }) {
  injectTheme();
  const cls = ['ctr-btn', 'ctr-btn--' + variant, size !== 'md' ? 'ctr-btn--' + size : '', fullWidth ? 'ctr-btn--full' : ''].filter(Boolean).join(' ');
  const iconSize = size === 'sm' ? 16 : 20;
  const content = [
    icon ? React.createElement(Icon, { key: 'i', name: icon, size: iconSize }) : null,
    children,
    iconRight ? React.createElement(Icon, { key: 'r', name: iconRight, size: iconSize }) : null
  ];
  if (href && !disabled) return React.createElement('a', { className: cls, href: href, style: style }, content);
  return React.createElement('button', { type: type, className: cls, disabled: disabled, onClick: onClick, style: style }, content);
}
