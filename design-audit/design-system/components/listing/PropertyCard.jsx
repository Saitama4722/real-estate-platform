import React from 'react';
import { injectTheme } from '../core/Theme.jsx';
import { Icon } from '../core/Icon.jsx';
import { IconButton } from '../core/IconButton.jsx';
import { Badge } from '../core/Badge.jsx';
const fmt = function (n) { return Number(n).toLocaleString('ru-RU') + ' \u20BD'; };
/** Карточка объекта: цена → спеки (комнаты/м²/этаж) → адрес. */
export function PropertyCard({ price, oldPrice, rooms, area, floor, floorTotal, address, image, priceDrop = false, isNew = false, favorite = false, compared = false, onFavorite, onCompare, href = '#', style }) {
  injectTheme();
  const stop = function (fn) { return function (e) { e.preventDefault(); e.stopPropagation(); if (fn) fn(); }; };
  return React.createElement('a', { className: 'ctr-card', href: href, style: style },
    React.createElement('div', { className: 'ctr-card__media' },
      image ? React.createElement('img', { src: image, alt: rooms + ', ' + address }) : null,
      React.createElement('div', { className: 'ctr-card__badges' },
        priceDrop ? React.createElement(Badge, { variant: 'accent' }, 'Цена снижена') : null,
        isNew ? React.createElement(Badge, { variant: 'primary' }, 'Новый объект') : null),
      React.createElement('div', { className: 'ctr-card__actions' },
        React.createElement(IconButton, { kind: 'compare', active: compared, onClick: stop(onCompare), label: 'Сравнить' }),
        React.createElement(IconButton, { kind: 'favorite', active: favorite, onClick: stop(onFavorite), label: 'В избранное' }))),
    React.createElement('div', { className: 'ctr-card__body' },
      React.createElement('div', { className: 'ctr-card__price' }, fmt(price),
        oldPrice ? React.createElement('span', { className: 'ctr-card__oldprice' }, fmt(oldPrice)) : null),
      React.createElement('div', { className: 'ctr-card__specs' },
        rooms ? React.createElement('span', null, React.createElement(Icon, { name: 'bed-double', size: 16 }), rooms) : null,
        area ? React.createElement('span', null, React.createElement(Icon, { name: 'ruler', size: 16 }), area + ' м²') : null,
        floor ? React.createElement('span', null, React.createElement(Icon, { name: 'building', size: 16 }), floor + (floorTotal ? '/' + floorTotal : '') + ' эт.') : null),
      React.createElement('div', { className: 'ctr-card__addr' }, React.createElement(Icon, { name: 'map-pin', size: 14 }), address)));
}
