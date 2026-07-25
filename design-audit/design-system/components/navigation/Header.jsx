import React from 'react';
import { injectTheme } from '../core/Theme.jsx';
import { Icon } from '../core/Icon.jsx';
import { Button } from '../core/Button.jsx';
const NAV = [{icon:'search',label:'Каталог',href:'#'},{icon:'map-pin',label:'Районы',href:'#'},{icon:'newspaper',label:'Статьи',href:'#'},{icon:'heart',label:'Избранное',href:'#'},{icon:'scale',label:'Сравнение',href:'#'}];
/** Шапка сайта. mobile=true — 390px вариант с бургер-меню. */
export function Header({ active, mobile = false, menuOpen, onMenuToggle }) {
  injectTheme();
  const inner = React.useState(false), open = menuOpen !== undefined ? menuOpen : inner[0];
  const toggle = onMenuToggle || function () { inner[1](!inner[0]); };
  const logo = React.createElement('a', { className: 'ctr-logo', href: '#' }, 'Centreal', React.createElement('i', null));
  if (mobile) {
    return React.createElement('header', { className: 'ctr-header ctr-header--mobile' },
      React.createElement('div', { className: 'ctr-header__in' }, logo,
        React.createElement('button', { className: 'ctr-burger', 'aria-label': open ? 'Закрыть меню' : 'Открыть меню', 'aria-expanded': open, onClick: toggle },
          React.createElement(Icon, { name: open ? 'x' : 'menu', size: 24 }))),
      open ? React.createElement('nav', { className: 'ctr-menu' },
        NAV.map(function (n, i) {
          return React.createElement('a', { key: i, className: 'ctr-menu__link', href: n.href },
            React.createElement(Icon, { name: n.icon, size: 20 }), n.label);
        }),
        React.createElement('div', { className: 'ctr-menu__cta' },
          React.createElement(Button, { variant: 'primary', fullWidth: true }, 'Продать недвижимость'),
          React.createElement(Button, { variant: 'outline', fullWidth: true, icon: 'user' }, 'Вход в личный кабинет'))) : null);
  }
  return React.createElement('header', { className: 'ctr-header' },
    React.createElement('div', { className: 'ctr-header__in' }, logo,
      React.createElement('nav', { className: 'ctr-header__nav' },
        NAV.map(function (n, i) {
          return React.createElement('a', { key: i, className: 'ctr-header__link' + (active === n.label ? ' is-active' : ''), href: n.href }, n.label);
        })),
      React.createElement('div', { className: 'ctr-header__cta' },
        React.createElement(Button, { variant: 'primary', size: 'sm' }, 'Продать недвижимость'),
        React.createElement(Button, { variant: 'outline', size: 'sm', icon: 'user' }, 'Вход в личный кабинет'))));
}
