// HUD: hotbar, mode pill, dialog, daily reward modal, achievements modal,
// achievement toast notifications.

import * as B from './blocks.js';
import { swatchColor } from './textures.js';
import { ACHIEVEMENTS, DAILY_REWARDS, blockName } from './achievements.js';
import { CATALOG, rarityMeta } from './shop.js';

export class UI {
  constructor() {
    this.hotbarEl = document.getElementById('hotbar');
    this.gemsEl = document.getElementById('gems-count');
    this.modeLabel = document.getElementById('mode-label');
    this.dialogEl = document.getElementById('dialog');
    this.dialogWho = this.dialogEl.querySelector('.who');
    this.dialogText = this.dialogEl.querySelector('.text');
    this.toasts = this.makeToastHost();
    this.modal = this.makeModal();
    this.onSlotClick = null;
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isModalOpen()) { this.closeModal(); e.stopPropagation(); }
    }, true);
    document.addEventListener('click', (e) => {
      const t = e.target;
      if (t && (t.id === 'modal-close' || t.closest && t.closest('#modal-close'))) {
        this.closeModal();
      }
    }, true);
  }

  buildHotbar(items, getCount) {
    this.hotbarEl.innerHTML = '';
    items.forEach((id, idx) => {
      const slot = document.createElement('div');
      slot.className = 'slot';
      slot.dataset.idx = idx;
      const swatch = document.createElement('div');
      swatch.className = 'swatch';
      swatch.style.background = swatchColor(id);
      const num = document.createElement('div'); num.className = 'num'; num.textContent = (idx + 1);
      const name = document.createElement('div'); name.className = 'name';
      slot.appendChild(num); slot.appendChild(swatch); slot.appendChild(name);
      slot.addEventListener('click', () => { if (this.onSlotClick) this.onSlotClick(idx); });
      slot.addEventListener('touchstart', (e) => { e.preventDefault(); if (this.onSlotClick) this.onSlotClick(idx); }, { passive: false });
      this.hotbarEl.appendChild(slot);
    });
    this.refreshHotbar(items, getCount);
  }

  refreshHotbar(items, getCount, activeIdx = -1) {
    const slots = this.hotbarEl.querySelectorAll('.slot');
    slots.forEach((slot, idx) => {
      const id = items[idx];
      const c = getCount(id);
      slot.classList.toggle('active', idx === activeIdx);
      const name = slot.querySelector('.name');
      name.textContent = c === Infinity ? '∞' : (c > 0 ? c : '');
      slot.style.opacity = (c === Infinity || c > 0) ? 1 : 0.45;
    });
  }

  setMode(mode) {
    if (mode === 'creative') {
      this.modeLabel.textContent = 'CREATIVE';
      this.modeLabel.className = 'creative';
    } else {
      this.modeLabel.textContent = 'SURVIVAL';
      this.modeLabel.className = 'survival';
    }
  }

  showDialog(who, text) {
    this.dialogWho.textContent = who;
    this.dialogText.textContent = text;
    this.dialogEl.style.display = 'block';
  }
  hideDialog() { this.dialogEl.style.display = 'none'; }

  makeToastHost() {
    let host = document.getElementById('toasts');
    if (!host) {
      host = document.createElement('div');
      host.id = 'toasts';
      host.style.cssText = 'position:fixed;top:60px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;gap:6px;z-index:50;pointer-events:none;';
      document.body.appendChild(host);
    }
    return host;
  }

  toast(title, text, color = '#ffd84a') {
    const el = document.createElement('div');
    el.style.cssText = `pointer-events:none;background:rgba(0,0,0,0.78);border:1px solid ${color};border-radius:10px;padding:10px 14px;color:#fff;font-size:14px;min-width:240px;box-shadow:0 6px 20px rgba(0,0,0,0.5);transform:translateY(-10px);opacity:0;transition:transform 220ms,opacity 220ms;`;
    el.innerHTML = `<div style="color:${color};font-weight:800;font-size:12px;letter-spacing:1px;">${title}</div><div>${text}</div>`;
    this.toasts.appendChild(el);
    requestAnimationFrame(() => { el.style.transform = 'translateY(0)'; el.style.opacity = '1'; });
    setTimeout(() => {
      el.style.transform = 'translateY(-10px)';
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 250);
    }, 3500);
  }

  makeModal() {
    let m = document.getElementById('modal');
    if (!m) {
      m = document.createElement('div');
      m.id = 'modal';
      m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:none;align-items:center;justify-content:center;z-index:80;pointer-events:auto;';
      m.innerHTML = `<div id="modal-card" style="max-width:560px;width:92vw;max-height:80vh;overflow:auto;background:#0f1530;border:1px solid rgba(255,255,255,0.18);border-radius:14px;color:#fff;font-size:14px;padding:18px;">
        <div id="modal-title" style="font-size:18px;font-weight:800;margin-bottom:8px;color:#ffd84a;">Заголовок</div>
        <div id="modal-body"></div>
        <div style="text-align:right;margin-top:12px;"><button id="modal-close" style="background:#ffd84a;color:#111;font-weight:700;padding:8px 14px;border:none;border-radius:8px;cursor:pointer;">Закрыть</button></div>
      </div>`;
      document.body.appendChild(m);
      m.addEventListener('click', (e) => { if (e.target === m) this.closeModal(); });
      m.querySelector('#modal-close').addEventListener('click', () => this.closeModal());
    }
    return m;
  }

  openModal(title, html) {
    this.modal.querySelector('#modal-title').textContent = title;
    this.modal.querySelector('#modal-body').innerHTML = html;
    this.modal.style.display = 'flex';
  }
  closeModal() { this.modal.style.display = 'none'; }
  isModalOpen() { return this.modal.style.display === 'flex'; }

  showAchievements(unlockedSet) {
    const rows = ACHIEVEMENTS.map(a => {
      const got = unlockedSet.has(a.id);
      const rewardStr = Object.entries(a.reward || {}).map(([id, n]) => `${blockName(+id)} ×${n}`).join(', ');
      return `<div style="display:flex;gap:10px;align-items:flex-start;padding:8px 4px;border-bottom:1px solid rgba(255,255,255,0.07);">
        <div style="width:28px;height:28px;border-radius:6px;background:${got ? '#ffd84a' : 'rgba(255,255,255,0.1)'};color:${got ? '#111' : '#888'};display:flex;align-items:center;justify-content:center;font-weight:800;flex-shrink:0;">${got ? '★' : '·'}</div>
        <div style="flex:1;">
          <div style="font-weight:700;color:${got ? '#ffd84a' : '#fff'};">${a.name}</div>
          <div style="opacity:.85;font-size:12px;">${a.desc}</div>
          ${rewardStr ? `<div style="font-size:11px;opacity:.7;margin-top:2px;">Награда: ${rewardStr}</div>` : ''}
        </div>
      </div>`;
    }).join('');
    const header = `<div style="opacity:.8;margin-bottom:6px;">Открыто ${unlockedSet.size}/${ACHIEVEMENTS.length}</div>`;
    this.openModal('Достижения', header + rows);
  }

  showDaily(daily, claimedToday, claimedReward) {
    const day = daily.currentDay();
    const days = DAILY_REWARDS.map(r => {
      const isCurrent = r.day === day && !claimedToday;
      const isPast = r.day < day || (r.day === day && claimedToday);
      const bg = isCurrent ? 'linear-gradient(180deg,#ffd84a,#e6a836)' : isPast ? 'rgba(110,231,255,0.15)' : 'rgba(255,255,255,0.06)';
      const color = isCurrent ? '#111' : '#fff';
      return `<div style="background:${bg};color:${color};padding:10px;border-radius:10px;text-align:center;font-weight:700;${isCurrent ? 'box-shadow:0 0 0 3px rgba(255,216,74,0.4);' : ''}">
        <div style="font-size:11px;opacity:.85;">День ${r.day}</div>
        <div style="font-size:13px;margin-top:4px;">${r.label}</div>
        ${isPast ? '<div style="font-size:10px;margin-top:4px;color:#6ee7ff;">получено</div>' : ''}
      </div>`;
    }).join('');
    const grid = `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin:10px 0;">${days}</div>`;
    const claimedNotice = claimedReward
      ? `<div style="padding:10px;border-radius:10px;background:rgba(110,231,255,0.15);border:1px solid rgba(110,231,255,0.4);margin-bottom:8px;"><b>Получено:</b> ${claimedReward.label}</div>`
      : '';
    const btn = claimedToday
      ? `<div style="opacity:.7;font-size:12px;text-align:center;margin-top:8px;">Возвращайтесь завтра, чтобы продолжить серию.</div>`
      : `<div style="text-align:center;margin-top:8px;"><button id="claim-daily" style="background:#ffd84a;color:#111;font-weight:800;padding:10px 20px;border:none;border-radius:10px;cursor:pointer;font-size:15px;">Забрать награду дня ${day}</button></div>`;
    this.openModal('Награда дня', `<div style="opacity:.85;margin-bottom:6px;">Серия: <b>${daily.state.streak}</b> дн.</div>${claimedNotice}${grid}${btn}`);
  }

  // ---------------- SHOP / LOOTBOX ----------------
  // Renders a cosmetic-only shop with disclosed lootbox odds.
  showShop(shop, onBuy, onEquip, onLootbox) {
    const gems = shop.gems();
    const ratesHtml = shop.rates().map(r => `<span style="color:${r.color};font-weight:700;">${r.label} — ${r.percent.toFixed(1)}%</span>`).join(' &middot; ');
    const lootboxBlock = `
      <div style="background:linear-gradient(135deg,rgba(255,184,74,0.2),rgba(155,135,255,0.2));border:1px solid rgba(255,255,255,0.2);border-radius:12px;padding:14px;margin-bottom:12px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
          <div>
            <div style="font-weight:800;color:#ffd84a;font-size:16px;">Космет-сундук</div>
            <div style="opacity:.85;font-size:12px;margin-top:2px;">Только косметика. На геймплей не влияет. Дубликаты не выпадают (возврат камешков).</div>
            <div style="font-size:11px;margin-top:6px;opacity:.9;">Шансы: ${ratesHtml}</div>
          </div>
          <button id="open-lootbox" style="background:#ffb84a;color:#111;font-weight:800;padding:10px 18px;border:none;border-radius:10px;cursor:pointer;white-space:nowrap;">
            Открыть · ${shop.lootboxPrice()} 💎
          </button>
        </div>
      </div>`;
    const items = CATALOG.map(item => {
      const meta = rarityMeta(item.rarity);
      const owned = shop.isOwned(item.id);
      const equipped = shop.equippedFor(item.kind)?.id === item.id;
      const swatch = (item.tint !== undefined)
        ? `<div style="width:40px;height:40px;border-radius:8px;background:#${item.tint.toString(16).padStart(6,'0')};border:1px solid rgba(255,255,255,0.2);"></div>`
        : `<div style="width:40px;height:40px;border-radius:8px;background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;font-size:18px;color:${meta.color};">✦</div>`;
      const action = equipped
        ? `<button class="shop-equip" data-id="${item.id}" data-kind="${item.kind}" data-mode="off" style="background:rgba(110,231,255,0.2);color:#6ee7ff;border:1px solid #6ee7ff;padding:6px 10px;border-radius:8px;cursor:pointer;font-weight:700;">Снять</button>`
        : owned
        ? `<button class="shop-equip" data-id="${item.id}" data-kind="${item.kind}" data-mode="on" style="background:#6ee7ff;color:#111;border:none;padding:6px 10px;border-radius:8px;cursor:pointer;font-weight:700;">Надеть</button>`
        : `<button class="shop-buy" data-id="${item.id}" style="background:${gems >= item.price ? '#ffd84a' : 'rgba(255,255,255,0.1)'};color:${gems >= item.price ? '#111' : '#888'};border:none;padding:6px 10px;border-radius:8px;cursor:${gems >= item.price ? 'pointer' : 'not-allowed'};font-weight:700;">${item.price} 💎</button>`;
      return `<div style="display:flex;gap:10px;align-items:center;padding:10px;border:1px solid ${equipped ? '#6ee7ff' : 'rgba(255,255,255,0.08)'};border-radius:10px;margin-bottom:6px;background:${equipped ? 'rgba(110,231,255,0.06)' : 'rgba(255,255,255,0.02)'};">
        ${swatch}
        <div style="flex:1;min-width:0;">
          <div style="font-weight:700;">${item.name}</div>
          <div style="font-size:11px;color:${meta.color};">${meta.label}</div>
        </div>
        ${action}
      </div>`;
    }).join('');
    const html = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <div style="opacity:.9;font-size:13px;">Только косметика. Никакого pay-to-win.</div>
        <div style="background:rgba(255,216,74,0.15);border:1px solid #ffd84a;border-radius:8px;padding:4px 10px;font-weight:800;color:#ffd84a;">${gems} 💎</div>
      </div>
      ${lootboxBlock}
      ${items}`;
    this.openModal('Магазин', html);
    const m = this.modal;
    m.querySelectorAll('.shop-buy').forEach(b => b.addEventListener('click', (e) => onBuy(e.currentTarget.dataset.id)));
    m.querySelectorAll('.shop-equip').forEach(b => b.addEventListener('click', (e) => onEquip(e.currentTarget.dataset.id, e.currentTarget.dataset.kind, e.currentTarget.dataset.mode)));
    const lb = m.querySelector('#open-lootbox');
    if (lb) lb.addEventListener('click', () => onLootbox());
  }

  updateGems(n) {
    if (this.gemsEl) this.gemsEl.textContent = String(n);
  }

  showLootboxResult(result, shop) {
    if (result.refund) {
      this.toast('СУНДУК', `Все предметы редкости «${rarityMeta(result.rarity).label}» уже собраны. Камешки возвращены.`, '#6ee7ff');
      return;
    }
    const item = result.item;
    const meta = rarityMeta(item.rarity);
    this.toast('ВЫПАЛО', `${item.name} (${meta.label})`, meta.color);
  }
}
