import React from 'react';
import { injectTheme } from './Theme.jsx';
/** Бейдж статуса. variant="accent" — только «Цена снижена» и горячие объекты. */
export function Badge({ variant = 'neutral', children }) {
  injectTheme();
  return React.createElement('span', { className: 'ctr-badge ctr-badge--' + variant }, children);
}
