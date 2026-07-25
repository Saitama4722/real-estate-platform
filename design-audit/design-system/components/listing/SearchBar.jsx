import React from 'react';
import { injectTheme } from '../core/Theme.jsx';
import { Icon } from '../core/Icon.jsx';
import { Button } from '../core/Button.jsx';
import { Input } from '../forms/Input.jsx';
import { Select } from '../forms/Select.jsx';
/** Панель поиска. stacked=true — мобильная (одна колонка). */
export function SearchBar({ stacked = false, onSubmit, onMap }) {
  injectTheme();
  const deal = React.useState('sale');
  return React.createElement('div', { className: 'ctr-search' + (stacked ? ' ctr-search--stacked' : '') },
    React.createElement('div', { className: 'ctr-seg', role: 'tablist' },
      React.createElement('button', { className: 'ctr-seg__btn' + (deal[0] === 'sale' ? ' is-active' : ''), onClick: function () { deal[1]('sale'); } }, 'Продажа'),
      React.createElement('button', { className: 'ctr-seg__btn' + (deal[0] === 'rent' ? ' is-active' : ''), onClick: function () { deal[1]('rent'); } }, 'Аренда')),
    React.createElement('div', { className: 'ctr-search__grid' },
      React.createElement(Select, { label: 'Тип недвижимости', options: ['Квартиры', 'Дома', 'Участки', 'Коммерция'] }),
      React.createElement(Select, { label: 'Город', options: ['Все города', 'Краснодар', 'Геленджик'] }),
      React.createElement(Select, { label: 'Район', options: ['Все районы'] }),
      React.createElement('div', { className: 'ctr-field' },
        React.createElement('span', { className: 'ctr-field__label' }, 'Цена, \u20BD'),
        React.createElement('div', { className: 'ctr-search__range' },
          React.createElement('input', { className: 'ctr-input', placeholder: 'от', inputMode: 'numeric' }),
          React.createElement('input', { className: 'ctr-input', placeholder: 'до', inputMode: 'numeric' })))),
    React.createElement('div', { className: 'ctr-search__row2' },
      React.createElement(Select, { label: 'Комнат', options: ['Любое', '1', '2', '3', '4+'] }),
      React.createElement(Select, { label: 'Рынок', options: ['Любой', 'Вторичный', 'Новостройка'] }),
      React.createElement(Input, { label: 'Поиск по тексту', icon: 'search', placeholder: 'Адрес, улица или ключевые слова' })),
    React.createElement('div', { className: 'ctr-search__footer' },
      React.createElement(Button, { variant: 'outline', icon: 'map', onClick: onMap }, 'На карте'),
      React.createElement(Button, { variant: 'primary', size: 'lg', icon: 'search', onClick: onSubmit, fullWidth: stacked, style: stacked ? undefined : { minWidth: 160 } }, 'Найти')));
}
