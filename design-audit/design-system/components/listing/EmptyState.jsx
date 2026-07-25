import React from 'react';
import { injectTheme } from '../core/Theme.jsx';
import { Icon } from '../core/Icon.jsx';
import { Button } from '../core/Button.jsx';
/** Пустое состояние: Избранное, Сравнение, заявки. */
export function EmptyState({ icon = 'inbox', title, text, actionLabel, actionIcon, onAction }) {
  injectTheme();
  return React.createElement('div', { className: 'ctr-empty' },
    React.createElement('div', { className: 'ctr-empty__icon' }, React.createElement(Icon, { name: icon, size: 28 })),
    React.createElement('h3', { className: 'ctr-empty__title' }, title),
    text ? React.createElement('p', { className: 'ctr-empty__text' }, text) : null,
    actionLabel ? React.createElement(Button, { variant: 'primary', icon: actionIcon, onClick: onAction }, actionLabel) : null);
}
