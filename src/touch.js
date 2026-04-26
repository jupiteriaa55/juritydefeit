// Mobile touch controls: virtual joystick + look pad + buttons.
// The joystick lives in a fixed circle on the bottom-left; the rest of the
// screen acts as a look pad. Buttons jump/place/break/mode/hotbar-cycle.

export class Touch {
  constructor(handlers) {
    this.h = handlers;
    this.stick = document.getElementById('stick');
    this.knob = this.stick.querySelector('.knob');
    this.touchPad = document.getElementById('touch');
    this.btnJump = document.getElementById('btn-jump');
    this.btnPlace = document.getElementById('btn-place');
    this.btnBreak = document.getElementById('btn-break');
    this.btnMode = document.getElementById('btn-mode');
    this.btnNext = document.getElementById('btn-next');
    this.activeStickId = null;
    this.activeLookId = null;
    this.lookPrev = null;
    this.enabled = false;
    this.bind();
  }

  enable(on) {
    this.enabled = on;
    this.touchPad.classList.toggle('on', !!on);
  }

  bind() {
    const stick = this.stick;
    const onStickStart = (e) => {
      if (!this.enabled) return;
      const t = e.changedTouches[0];
      this.activeStickId = t.identifier;
      this.updateStick(t);
      e.preventDefault();
    };
    const onStickMove = (e) => {
      if (this.activeStickId === null) return;
      for (const t of e.changedTouches) if (t.identifier === this.activeStickId) {
        this.updateStick(t); break;
      }
      e.preventDefault();
    };
    const onStickEnd = (e) => {
      for (const t of e.changedTouches) if (t.identifier === this.activeStickId) {
        this.activeStickId = null;
        this.knob.style.transform = '';
        this.h.move(0, 0);
        e.preventDefault();
        return;
      }
    };
    stick.addEventListener('touchstart', onStickStart, { passive: false });
    stick.addEventListener('touchmove', onStickMove, { passive: false });
    stick.addEventListener('touchend', onStickEnd, { passive: false });
    stick.addEventListener('touchcancel', onStickEnd, { passive: false });

    // Look pad: any touch on the pad that isn't the joystick or buttons
    this.touchPad.addEventListener('touchstart', (e) => {
      if (!this.enabled) return;
      for (const t of e.changedTouches) {
        if (t.identifier === this.activeStickId) continue;
        if (this.isOnControl(t.target)) continue;
        this.activeLookId = t.identifier;
        this.lookPrev = { x: t.clientX, y: t.clientY };
        e.preventDefault();
        return;
      }
    }, { passive: false });
    this.touchPad.addEventListener('touchmove', (e) => {
      if (this.activeLookId === null) return;
      for (const t of e.changedTouches) if (t.identifier === this.activeLookId) {
        const dx = t.clientX - this.lookPrev.x;
        const dy = t.clientY - this.lookPrev.y;
        this.lookPrev = { x: t.clientX, y: t.clientY };
        this.h.look(dx, dy);
        e.preventDefault();
        return;
      }
    }, { passive: false });
    this.touchPad.addEventListener('touchend', (e) => {
      for (const t of e.changedTouches) if (t.identifier === this.activeLookId) {
        this.activeLookId = null;
        this.lookPrev = null;
        e.preventDefault();
        return;
      }
    }, { passive: false });

    const btn = (el, fn) => {
      el.addEventListener('touchstart', (e) => { e.preventDefault(); fn(true); }, { passive: false });
      el.addEventListener('touchend', (e) => { e.preventDefault(); fn(false); }, { passive: false });
      el.addEventListener('mousedown', () => fn(true));
      el.addEventListener('mouseup', () => fn(false));
      el.addEventListener('mouseleave', () => fn(false));
    };
    btn(this.btnJump, (down) => this.h.jump(down));
    btn(this.btnPlace, (down) => { if (down) this.h.place(); });
    btn(this.btnBreak, (down) => { if (down) this.h.breakBlock(); });
    btn(this.btnMode, (down) => { if (down) this.h.toggleMode(); });
    btn(this.btnNext, (down) => { if (down) this.h.nextSlot(); });
  }

  isOnControl(target) {
    return !!(target && (target.closest && (target.closest('#stick') || target.closest('.tbtn') || target.closest('#hotbar') || target.closest('#dialog') || target.closest('#modal'))));
  }

  updateStick(t) {
    const rect = this.stick.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = t.clientX - cx;
    let dy = t.clientY - cy;
    const r = rect.width / 2 - 24;
    const m = Math.hypot(dx, dy);
    if (m > r) { dx = dx / m * r; dy = dy / m * r; }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const nx = dx / r;
    const ny = dy / r;
    this.h.move(nx, ny);
  }
}
