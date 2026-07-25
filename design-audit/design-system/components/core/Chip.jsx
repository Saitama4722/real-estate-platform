import React from 'react';
import { injectTheme } from './Theme.jsx';
import { Icon } from './Icon.jsx';
/** Чип активного фильтра. removable — с крестиком. */
export function Chip({ children, active = false, removable = false, icon, onClick, onRemove }) {
  injectTheme();
  return React.createElement('button', { type: 'button', className: 'ctr-chip' + (active ? ' is-active' : ''), onClick: onClick },
    icon ? React.createElement(Icon, { name: icon, size: 16 }) : null,
    children,
    removable ? React.createElement('span', { className: 'ctr-chip__x', onClick: function (e) { e.stopPropagation(); if (onRemove) onRemove(); } },
      React.createElement(Icon, { name: 'x', size: 14 })) : null);
}
