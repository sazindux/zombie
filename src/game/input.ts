interface Stick {
  id: number;
  ox: number;
  oy: number;
  x: number;
  y: number;
  active: boolean;
}

const STICK_R = 60;

export class Input {
  keys = new Set<string>();
  pressed = new Set<string>();
  mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2, down: false };
  rightPressed = false;
  wheel = 0;
  touchMode = false;
  moveStick: Stick = { id: -1, ox: 0, oy: 0, x: 0, y: 0, active: false };
  aimStick: Stick = { id: -1, ox: 0, oy: 0, x: 0, y: 0, active: false };
  private el: HTMLElement;

  constructor(el: HTMLElement) {
    this.el = el;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
    el.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    el.addEventListener('contextmenu', this.onContext);
    window.addEventListener('wheel', this.onWheel, { passive: true });
    window.addEventListener('blur', this.onBlur);
    el.addEventListener('touchstart', this.onTouchStart, { passive: false });
    el.addEventListener('touchmove', this.onTouchMove, { passive: false });
    el.addEventListener('touchend', this.onTouchEnd, { passive: false });
    el.addEventListener('touchcancel', this.onTouchEnd, { passive: false });
  }

  destroy() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    this.el.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    this.el.removeEventListener('contextmenu', this.onContext);
    window.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('blur', this.onBlur);
    this.el.removeEventListener('touchstart', this.onTouchStart);
    this.el.removeEventListener('touchmove', this.onTouchMove);
    this.el.removeEventListener('touchend', this.onTouchEnd);
    this.el.removeEventListener('touchcancel', this.onTouchEnd);
  }

  /** Movement vector from keyboard or touch stick, length <= 1. */
  moveVec(): { x: number; y: number } {
    if (this.moveStick.active) {
      const dx = this.moveStick.x - this.moveStick.ox;
      const dy = this.moveStick.y - this.moveStick.oy;
      const l = Math.hypot(dx, dy);
      if (l > 8) {
        const k = Math.min(1, l / STICK_R);
        return { x: (dx / l) * k, y: (dy / l) * k };
      }
      return { x: 0, y: 0 };
    }
    let x = 0;
    let y = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y += 1;
    const l = Math.hypot(x, y);
    if (l > 0) return { x: x / l, y: y / l };
    return { x: 0, y: 0 };
  }

  /** Touch aim: returns angle & whether it's firing, or null. */
  aimVec(): { angle: number; fire: boolean } | null {
    if (!this.aimStick.active) return null;
    const dx = this.aimStick.x - this.aimStick.ox;
    const dy = this.aimStick.y - this.aimStick.oy;
    const l = Math.hypot(dx, dy);
    if (l < 12) return null;
    return { angle: Math.atan2(dy, dx), fire: l > 24 };
  }

  endFrame() {
    this.pressed.clear();
    this.rightPressed = false;
    this.wheel = 0;
  }

  reset() {
    this.keys.clear();
    this.pressed.clear();
    this.mouse.down = false;
    this.rightPressed = false;
    this.moveStick.active = false;
    this.aimStick.active = false;
  }

  stickRadius() {
    return STICK_R;
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    if (!e.repeat) this.pressed.add(e.code);
    this.keys.add(e.code);
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };
  private onMouseMove = (e: MouseEvent) => {
    this.mouse.x = e.clientX;
    this.mouse.y = e.clientY;
    this.touchMode = false;
  };
  private onMouseDown = (e: MouseEvent) => {
    this.mouse.x = e.clientX;
    this.mouse.y = e.clientY;
    if (e.button === 0) this.mouse.down = true;
    if (e.button === 2) this.rightPressed = true;
    this.touchMode = false;
  };
  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.mouse.down = false;
  };
  private onContext = (e: Event) => e.preventDefault();
  private onWheel = (e: WheelEvent) => {
    this.wheel += Math.sign(e.deltaY);
  };
  private onBlur = () => {
    this.keys.clear();
    this.mouse.down = false;
  };

  private onTouchStart = (e: TouchEvent) => {
    e.preventDefault();
    this.touchMode = true;
    for (const t of Array.from(e.changedTouches)) {
      const left = t.clientX < window.innerWidth / 2;
      const s = left ? this.moveStick : this.aimStick;
      if (s.active) continue;
      s.active = true;
      s.id = t.identifier;
      s.ox = s.x = t.clientX;
      s.oy = s.y = t.clientY;
    }
  };
  private onTouchMove = (e: TouchEvent) => {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      for (const s of [this.moveStick, this.aimStick]) {
        if (s.active && s.id === t.identifier) {
          s.x = t.clientX;
          s.y = t.clientY;
          // let the origin follow so the stick never goes out of reach
          const dx = s.x - s.ox;
          const dy = s.y - s.oy;
          const l = Math.hypot(dx, dy);
          if (l > STICK_R * 1.6) {
            s.ox = s.x - (dx / l) * STICK_R * 1.6;
            s.oy = s.y - (dy / l) * STICK_R * 1.6;
          }
        }
      }
    }
  };
  private onTouchEnd = (e: TouchEvent) => {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      for (const s of [this.moveStick, this.aimStick]) {
        if (s.active && s.id === t.identifier) s.active = false;
      }
    }
  };
}
