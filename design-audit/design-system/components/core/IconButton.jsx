import React from 'react';
import { injectTheme } from './Theme.jsx';
import { Icon } from './Icon.jsx';
/** Круглая иконочная кнопка. kind="favorite" — сердце (актив = красный), kind="compare" — весы (актив = синий). */
export function IconButton({ icon, kind, active = false, onClick, label, size = 36, iconSize = 18 }) {
  injectTheme();
  const name = icon || (kind === 'favorite' ? 'heart' : kind === 'compare' ? 'scale' : 'share-2');
  const cls = ['ctr-iconbtn', active && kind === 'favorite' ? 'is-active-fav' : '', active && kind === 'compare' ? 'is-active-cmp' : ''].filter(Boolean).join(' ');
  return React.createElement('button', { type: 'button', className: cls, onClick: onClick, 'aria-label': label, 'aria-pressed': active, style: { width: size, height: size } },
    React.createElement(Icon, { name: name, size: iconSize }));
}
