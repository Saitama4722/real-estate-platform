import React from 'react';
import { injectTheme } from '../core/Theme.jsx';
import { Icon } from '../core/Icon.jsx';
/** Галерея объекта: кросс-фейд 300ms, миниатюры, стрелки по hover. */
export function Gallery({ images = [], alt = 'Фото объекта' }) {
  injectTheme();
  const st = React.useState(0), i = st[0], set = st[1];
  const go = function (d) { set(function (p) { return (p + d + images.length) % images.length; }); };
  return React.createElement('div', { className: 'ctr-gallery' },
    React.createElement('div', { className: 'ctr-gallery__stage' },
      images.map(function (src, n) {
        return React.createElement('div', { key: n, className: 'ctr-gallery__slide' + (n === i ? ' is-current' : '') },
          React.createElement('img', { src: src, alt: alt + ' ' + (n + 1) }));
      }),
      React.createElement('button', { className: 'ctr-gallery__nav ctr-gallery__nav--prev', onClick: function () { go(-1); }, 'aria-label': 'Предыдущее фото' },
        React.createElement(Icon, { name: 'chevron-left', size: 20 })),
      React.createElement('button', { className: 'ctr-gallery__nav ctr-gallery__nav--next', onClick: function () { go(1); }, 'aria-label': 'Следующее фото' },
        React.createElement(Icon, { name: 'chevron-right', size: 20 }))),
    React.createElement('div', { className: 'ctr-gallery__thumbs' },
      images.map(function (src, n) {
        return React.createElement('button', { key: n, className: 'ctr-gallery__thumb' + (n === i ? ' is-current' : ''), onClick: function () { set(n); }, 'aria-label': 'Фото ' + (n + 1) },
          React.createElement('img', { src: src, alt: '' }));
      })));
}
