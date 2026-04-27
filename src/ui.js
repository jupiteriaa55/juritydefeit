// DOM-привязки UI: верхний бар, панель заказа, панель инструментов, тосты, модалки.
// Игровой код общается с UI через простой объект-слой (set*, callbacks).

import { ITEM_DEFS, TOOLBAR_ORDER, CAT } from './items.js';

const $ = (sel) => document.querySelector(sel);

export class UI {
  constructor(handlers) {
    this.h = handlers; // { onTool, onEndDay, onNewOrder, onFinishOrder, onZoomIn, onZoomOut }
    this.activeTool = null;
    this._buildToolbar();
    this._bindButtons();
  }

  _buildToolbar() {
    const grid = $('#tool-grid');
    grid.innerHTML = '';
    const groups = [
      { title: 'Действия', cat: CAT.ACTION },
      { title: 'Надгробия', cat: CAT.TOMB },
      { title: 'Цветы',     cat: CAT.FLOWER },
      { title: 'Дорожки',   cat: CAT.PATH },
      { title: 'Декор',     cat: CAT.DECO },
    ];
    for (const g of groups) {
      const items = TOOLBAR_ORDER
        .map(id => ITEM_DEFS[id])
        .filter(d => d.cat === g.cat && !d.notBuyable);
      if (!items.length) continue;
      const head = document.createElement('div');
      head.style.gridColumn = '1 / -1';
      head.style.color = 'var(--accent)';
      head.style.fontSize = '12px';
      head.style.fontWeight = '600';
      head.style.margin = '6px 0 2px';
      head.textContent = g.title;
      grid.appendChild(head);
      for (const def of items) {
        const el = document.createElement('button');
        el.className = 'tool';
        el.dataset.id = def.id;
        el.title = `${def.name}${def.cost ? ` — ${def.cost}⛀` : ''}`;
        el.innerHTML = `<span style="font-size:18px">${def.icon || '•'}</span><span class="name">${def.name}</span><span class="price">${def.cost ? `${def.cost}⛀` : '—'}</span>`;
        el.addEventListener('click', () => {
          this.setActiveTool(def.id);
          this.h.onTool?.(def.id);
        });
        grid.appendChild(el);
      }
    }
  }

  setActiveTool(id) {
    this.activeTool = id;
    const grid = $('#tool-grid');
    grid.querySelectorAll('.tool').forEach(el => {
      el.classList.toggle('active', el.dataset.id === id);
    });
  }
  clearTool() { this.setActiveTool(null); }

  _bindButtons() {
    $('#btn-end-day').addEventListener('click', () => this.h.onEndDay?.());
    $('#btn-new-order').addEventListener('click', () => this.h.onNewOrder?.());
    $('#btn-finish-order').addEventListener('click', () => this.h.onFinishOrder?.());
    $('#btn-zoom-in').addEventListener('click', () => this.h.onZoomIn?.());
    $('#btn-zoom-out').addEventListener('click', () => this.h.onZoomOut?.());
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { this.clearTool(); this.h.onTool?.(null); }
      if (e.key === 'd' || e.key === 'D' || e.key === 'в' || e.key === 'В') this.h.onTool?.('dog');
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
      $('#order-desc').textContent = 'Нет активного заказа. Возьмите новый.';
      $('#order-name').textContent = '—';
      $('#order-style').textContent = '—';
      $('#order-budget').textContent = '—';
      $('#order-days').textContent = '—';
      $('#order-spent').textContent = '0';
      $('#order-current-style').textContent = '0';
      return;
    }
    $('#order-title').textContent = `Заказ: ${order.levelName}`;
    $('#order-desc').textContent = `Похоронить ${order.name}. Семья ожидает «${order.levelName.toLowerCase()}» обустройство. Бюджет ограничен.`;
    $('#order-name').textContent = order.name;
    $('#order-style').textContent = `≥ ${order.minStyle}`;
    $('#order-budget').textContent = `${order.expBudget}⛀ (макс ~${Math.round(order.expBudget * 1.4)}⛀)`;
    $('#order-days').textContent = `${order.daysLeft}/${order.deadline}`;
    $('#order-spent').textContent = `${order.spent}⛀`;
    $('#order-current-style').textContent = style.toFixed(1);
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
