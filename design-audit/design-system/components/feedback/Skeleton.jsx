import React from 'react';
import { injectTheme } from '../core/Theme.jsx';
/** Плашка-скелетон. Показывать, если ответ дольше 200 мс. */
export function Skeleton({ width = '100%', height = 14, radius = 4, style }) {
  injectTheme();
  return React.createElement('div', { className: 'ctr-skeleton', style: Object.assign({ width: width, height: height, borderRadius: radius }, style) });
}
/** Скелетон карточки объекта — та же геометрия, что у PropertyCard. */
export function PropertyCardSkeleton({ style }) {
  injectTheme();
  return React.createElement('div', { className: 'ctr-card ctr-card--skeleton', style: style },
    React.createElement('div', { className: 'ctr-card__media' }, React.createElement('div', { className: 'ctr-skeleton ctr-skeleton--media' })),
    React.createElement('div', { className: 'ctr-card__body' },
      React.createElement('div', { className: 'ctr-skeleton ctr-skeleton--price' }),
      React.createElement('div', { className: 'ctr-skeleton ctr-skeleton--specs' }),
      React.createElement('div', { className: 'ctr-skeleton ctr-skeleton--addr' })));
}
