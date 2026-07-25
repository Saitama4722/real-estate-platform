import React from 'react';
import { injectTheme } from '../core/Theme.jsx';
const Q1 = ['Купить квартиру в Краснодаре', 'Купить участок в Краснодаре', 'Купить дом в Геленджике'];
const Q2 = ['Купить дом в Краснодаре', 'Купить квартиру в Геленджике', 'Купить коммерцию в Краснодаре'];
export function Footer() {
  injectTheme();
  const link = function (t, i) { return React.createElement('a', { key: i, className: 'ctr-footer__link', href: '#' }, t); };
  return React.createElement('footer', { className: 'ctr-footer' },
    React.createElement('div', { className: 'ctr-footer__in' },
      React.createElement('div', { className: 'ctr-footer__top' },
        React.createElement('div', null,
          React.createElement('a', { className: 'ctr-logo', href: '#' }, 'Centreal', React.createElement('i', null)),
          React.createElement('p', { className: 'ctr-footer__note' }, 'Недвижимость в Краснодаре и Геленджике: квартиры, дома, участки и коммерческие помещения.')),
        React.createElement('div', null, React.createElement('p', { className: 'ctr-footer__h' }, 'Популярные запросы'), Q1.map(link)),
        React.createElement('div', null, React.createElement('p', { className: 'ctr-footer__h' }, '\u00A0'), Q2.map(link))),
      React.createElement('div', { className: 'ctr-footer__bottom' },
        React.createElement('span', null, '© 2026 Centreal. Краснодарский край.'),
        React.createElement('span', null,
          React.createElement('a', { href: '#' }, 'Каталог'), React.createElement('a', { href: '#' }, 'Статьи'),
          React.createElement('a', { href: '#' }, 'Политика конфиденциальности'), React.createElement('a', { href: '#' }, 'Пользовательское соглашение')))));
}
