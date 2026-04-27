// DOM-привязки UI: верхний бар, панель заказа, табы инструментов, тосты, модалки.
// Игровой код общается с UI через простой объект-слой (set*, callbacks).

import { ITEM_DEFS, TOOLBAR_ORDER, CAT } from './items.js';

const $ = (sel) => document.querySelector(sel);

const TABS = [
  { id: CAT.ACTION,  title: 'Действия',   icon: '⚒' },
  { id: CAT.CROSS,   title: 'Кресты',     icon: '✟' },
  { id: CAT.TOMB,    title: 'Памятники',  icon: '🪦' },
  { id: CAT.FLOWER,  title: 'Цветы',      icon: '🌹' },
  { id: CAT.PATH,    title: 'Дорожки',    icon: '▦' },
  { id: CAT.DECO,    title: 'Декор',      icon: '🏛' },
  { id: CAT.NATURE,  title: 'Природа',    icon: '🌳' },
];

export class UI {
  constructor(handlers) {
    this.h = handlers;
    this.activeTool = null;
    this.activeTab = CAT.ACTION;
    this._buildTabs();
    this._buildToolbar();
    this._bindButtons();
    this._hideLoader();
  }

  _hideLoader() {
    const l = document.getElementById('loader');
    if (!l) return;
    setTimeout(() => {
      l.classList.add('hide');
      setTimeout(() => l.remove(), 600);
    }, 200);
  }

  _buildTabs() {
    const host = $('#tabs');
    if (!host) return;
    host.innerHTML = '';
    for (const t of TABS) {
      const b = document.createElement('button');
      b.className = 'tab' + (t.id === this.activeTab ? ' active' : '');
      b.dataset.tab = t.id;
      b.innerHTML = `<span class="tab-ico">${t.icon}</span><span>${t.title}</span>`;
      b.addEventListener('click', () => {
        this.activeTab = t.id;
        host.querySelectorAll('.tab').forEach(el => el.classList.toggle('active', el.dataset.tab === t.id));
        this._buildToolbar();
      });
      host.appendChild(b);
    }
  }

  _buildToolbar() {
    const grid = $('#tool-grid');
    grid.innerHTML = '';
    const items = TOOLBAR_ORDER
      .map(id => ITEM_DEFS[id])
      .filter(d => d && d.cat === this.activeTab && !d.notBuyable);
    for (const def of items) {
      const el = document.createElement('button');
      el.className = 'tool' + (this.activeTool === def.id ? ' active' : '');
      el.dataset.id = def.id;
      el.title = `${def.name}${def.cost ? ` — ${def.cost}⛀` : ''}`;
      el.innerHTML =
        `<span class="ico">${def.icon || '•'}</span>` +
        `<span class="name">${def.name}</span>` +
        `<span class="price">${def.cost ? `${def.cost}⛀` : '—'}</span>`;
      el.addEventListener('click', () => {
        this.setActiveTool(def.id);
        this.h.onTool?.(def.id);
      });
      grid.appendChild(el);
    }
    if (!items.length) {
      grid.innerHTML = '<div style="color:var(--muted);text-align:center;padding:20px;font-size:13px">Здесь пусто.</div>';
    }
  }

  setActiveTool(id) {
    this.activeTool = id;
    document.querySelectorAll('#tool-grid .tool').forEach(el => {
      el.classList.toggle('active', el.dataset.id === id);
    });
    if (id) {
      const def = ITEM_DEFS[id];
      if (def && def.cat !== this.activeTab) {
        this.activeTab = def.cat;
        document.querySelectorAll('.tab').forEach(el => el.classList.toggle('active', el.dataset.tab === def.cat));
        this._buildToolbar();
      }
    }
  }
  clearTool() { this.setActiveTool(null); }

  _bindButtons() {
    $('#btn-end-day').addEventListener('click', () => this.h.onEndDay?.());
    $('#btn-new-order').addEventListener('click', () => this.h.onNewOrder?.());
    $('#btn-finish-order').addEventListener('click', () => this.h.onFinishOrder?.());
    $('#btn-zoom-in').addEventListener('click', () => this.h.onZoomIn?.());
    $('#btn-zoom-out').addEventListener('click', () => this.h.onZoomOut?.());
    $('#btn-center')?.addEventListener('click', () => this.h.onCenter?.());
    $('#btn-dog')?.addEventListener('click', () => { this.setActiveTool('dog'); this.h.onTool?.('dog'); });

    // Сворачивание панелей.
    const orderPanel = $('#order-panel');
    const buildPanel = $('#build-panel');
    $('#order-collapser')?.addEventListener('click', (e) => {
      orderPanel.classList.toggle('collapsed');
      e.currentTarget.classList.toggle('collapsed');
      e.currentTarget.textContent = orderPanel.classList.contains('collapsed') ? '›' : '‹';
      e.currentTarget.style.left = orderPanel.classList.contains('collapsed') ? '10px' : '';
    });
    $('#build-collapser')?.addEventListener('click', (e) => {
      buildPanel.classList.toggle('collapsed');
      e.currentTarget.classList.toggle('collapsed');
      e.currentTarget.textContent = buildPanel.classList.contains('collapsed') ? '‹' : '›';
      e.currentTarget.style.right = buildPanel.classList.contains('collapsed') ? '10px' : '';
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { this.clearTool(); this.h.onTool?.(null); }
      if (e.key === 'd' || e.key === 'D' || e.key === 'в' || e.key === 'В') {
        this.setActiveTool('dog'); this.h.onTool?.('dog');
      }
    });
  }

  setStats({ day, money, rep }) {
    $('#stat-day').textContent = day;
    $('#stat-money').textContent = money;
    $('#stat-rep').textContent = rep;
  }

  setOrder(order, style = 0) {
    if (!order) {
      $('#order-title').textContent = 'Заказ';
      $('#order-level').textContent = '—';
      $('#order-desc').textContent = 'Нет активного заказа. Нажмите «Новый заказ».';
      $('#order-name').textContent = '—';
      $('#order-style').textContent = '—';
      $('#order-budget').textContent = '—';
      $('#order-days').textContent = '—';
      $('#order-spent').textContent = '0';
      $('#order-spent-max').textContent = '—';
      $('#order-current-style').textContent = '0';
      $('#order-min-style').textContent = '—';
      $('#order-spent-bar > span').style.width = '0%';
      $('#order-style-bar > span').style.width = '0%';
      return;
    }
    $('#order-title').textContent = order.name.split(' ')[0];
    $('#order-level').textContent = order.levelName;
    $('#order-desc').textContent = `Похоронить ${order.name}. Семья ожидает «${order.levelName.toLowerCase()}» обустройство.`;
    $('#order-name').textContent = order.name.split(' ').slice(0, 2).join(' ');
    $('#order-style').textContent = `≥ ${order.minStyle}`;
    const cap = Math.round(order.expBudget * 1.4);
    $('#order-budget').textContent = `${order.expBudget}⛀`;
    $('#order-days').textContent = `${Math.max(0, order.daysLeft)}/${order.deadline}`;
    $('#order-spent').textContent = `${order.spent}⛀`;
    $('#order-spent-max').textContent = `${cap}⛀`;
    $('#order-current-style').textContent = style.toFixed(1);
    $('#order-min-style').textContent = order.minStyle;

    const spentPct = Math.min(120, (order.spent / cap) * 100);
    const spentBar = $('#order-spent-bar');
    spentBar.classList.toggle('over', order.spent > cap);
    spentBar.querySelector('span').style.width = spentPct + '%';

    const stylePct = Math.min(100, (style / order.minStyle) * 100);
    $('#order-style-bar > span').style.width = stylePct + '%';
  }

  toast(text, kind = '') {
    const host = $('#toast-host');
    const t = document.createElement('div');
    t.className = `toast ${kind}`;
    t.textContent = text;
    host.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .4s'; }, 2400);
    setTimeout(() => { t.remove(); }, 3000);
  }

  modal({ title, body, input = false, inputPlaceholder = '', okText = 'OK', cancelText = 'Отмена', onOk, onCancel }) {
    const host = $('#modal-host');
    const modal = $('#modal');
    modal.innerHTML = '';
    const h = document.createElement('h2'); h.textContent = title; modal.appendChild(h);
    const p = document.createElement('p'); p.textContent = body; modal.appendChild(p);
    let inputEl = null;
    if (input) {
      inputEl = document.createElement('input');
      inputEl.type = 'text';
      inputEl.placeholder = inputPlaceholder;
      modal.appendChild(inputEl);
      setTimeout(() => inputEl.focus(), 30);
    }
    const actions = document.createElement('div'); actions.className = 'actions';
    const close = () => { host.classList.remove('open'); };
    if (cancelText) {
      const c = document.createElement('button');
      c.className = 'btn'; c.textContent = cancelText;
      c.addEventListener('click', () => { close(); onCancel?.(); });
      actions.appendChild(c);
    }
    const ok = document.createElement('button');
    ok.className = 'btn primary'; ok.textContent = okText;
    ok.addEventListener('click', () => {
      const val = inputEl ? inputEl.value.trim() : true;
      close(); onOk?.(val);
    });
    actions.appendChild(ok);
    modal.appendChild(actions);
    host.classList.add('open');
  }
}
