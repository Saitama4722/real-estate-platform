import React from 'react';
const CDN = 'https://unpkg.com/lucide@0.462.0/dist/umd/lucide.min.js';
let loading = null;
function ensureLucide() {
  if (window.lucide && window.lucide.icons) return Promise.resolve();
  if (!loading) loading = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = CDN; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
  return loading;
}
const pascal = (n) => String(n).split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
function toReact(node, key) {
  const tag = node[0], attrs = node[1] || {}, children = node[2];
  return React.createElement(tag, Object.assign({ key: key }, attrs), Array.isArray(children) ? children.map(toReact) : undefined);
}
/** Иконка Lucide по kebab-имени: <Icon name="heart" size={20} /> */
export function Icon({ name, size = 20, strokeWidth = 2, color = 'currentColor', style, className }) {
  const forceUpdate = React.useReducer((x) => x + 1, 0)[1];
  React.useEffect(() => { if (!(window.lucide && window.lucide.icons)) ensureLucide().then(forceUpdate).catch(() => {}); }, []);
  const icons = (window.lucide && window.lucide.icons) || {};
  const node = icons[pascal(name)] || icons[name];
  const base = { xmlns: 'http://www.w3.org/2000/svg', width: size, height: size, viewBox: '0 0 24 24',
    fill: 'none', stroke: color, strokeWidth: strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round',
    style: style, className: className, 'aria-hidden': true };
  if (!node) return React.createElement('svg', base);
  if (node[0] === 'svg') return React.createElement('svg', base, (node[2] || []).map(toReact));
  return React.createElement('svg', base, node.map(toReact));
}
