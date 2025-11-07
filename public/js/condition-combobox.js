/* eslint-disable */
;
(function () {
  // Basic, dependency-free combobox with multi-select checkboxes.
  // Keyboard: Up/Down to move, Enter/Space to toggle, Esc to close.
  // ARIA: combobox with listbox; active option via aria-activedescendant on input.

  function Combobox($root) {
    this.$root = $root;
    this.$input = $root.querySelector('.crp-combobox__input');
    this.$dropdown = $root.querySelector('.crp-combobox__dropdown');
    this.$listbox = $root.querySelector('.crp-combobox__listbox');
    this.all = window.CRPDATA && window.CRPDATA.all || [];
    this.selected = new Set(window.CRPDATA && window.CRPDATA.selected || []);
    this.activeIndex = -1;
    this.filtered = this.all.slice(0);

    // External targets
    this.$chips = document.getElementById('selected-chips');
    this.$hidden = document.getElementById('selected-hidden');
    this.$count = document.getElementById('selected-count');
    this.init();
  }
  Combobox.prototype.init = function () {
    this.renderList();
    this.renderChips();
    this.syncHiddenInputs();
    this.bindEvents();
  };
  Combobox.prototype.bindEvents = function () {
    const input = this.$input;
    input.addEventListener('input', this.onType.bind(this));
    input.addEventListener('focus', this.open.bind(this));
    input.addEventListener('keydown', e => {
      const key = e.key;
      if (!this.isOpen() && (key === 'ArrowDown' || key === 'ArrowUp')) {
        this.open();
      }
      if (key === 'ArrowDown') {
        e.preventDefault();
        this.move(1);
      } else if (key === 'ArrowUp') {
        e.preventDefault();
        this.move(-1);
      } else if (key === 'Enter' || key === ' ') {
        if (this.isOpen() && this.activeIndex > -1) {
          e.preventDefault();
          this.toggleActive();
        }
      } else if (key === 'Escape') {
        this.close();
      }
    });
    document.addEventListener('click', e => {
      if (!this.$root.contains(e.target)) this.close();
    });
    this.$listbox.addEventListener('click', e => {
      const item = e.target.closest('[data-index]');
      if (!item) return;
      this.activeIndex = parseInt(item.getAttribute('data-index'), 10);
      this.toggleActive();
      this.$input.focus();
    });
  };
  Combobox.prototype.onType = function () {
    const q = this.$input.value.toLowerCase();
    this.filtered = this.all.filter(c => c.toLowerCase().includes(q));
    this.activeIndex = this.filtered.length ? 0 : -1;
    this.open();
    this.renderList();
  };
  Combobox.prototype.move = function (delta) {
    const max = this.filtered.length - 1;
    if (max < 0) return;
    this.activeIndex = Math.max(0, Math.min(max, this.activeIndex + delta));
    this.updateActiveDescendant();
    this.ensureActiveInView();
    this.highlightActive();
  };
  Combobox.prototype.toggleActive = function () {
    const item = this.filtered[this.activeIndex];
    if (!item) return;
    if (this.selected.has(item)) {
      this.selected.delete(item);
    } else {
      this.selected.add(item);
    }
    this.renderList();
    this.renderChips();
    this.syncHiddenInputs();
    this.updateCount();
  };
  Combobox.prototype.renderList = function () {
    const html = this.filtered.map((text, i) => {
      const id = 'opt-' + i;
      const checked = this.selected.has(text);
      const active = i === this.activeIndex;
      return `
        <li id="${id}" class="crp-combobox__option ${active ? 'is-active' : ''}" role="option"
            aria-selected="${checked ? 'true' : 'false'}" data-index="${i}">
          <span class="crp-combobox__checkbox" aria-hidden="true">
            <input type="checkbox" tabindex="-1" ${checked ? 'checked' : ''} />
          </span>
          <span class="crp-combobox__text">${text}</span>
        </li>`;
    }).join('');
    this.$listbox.innerHTML = html || `<li class="crp-combobox__empty" aria-live="polite">No results</li>`;
    this.updateActiveDescendant();
    this.highlightActive();
  };
  Combobox.prototype.renderChips = function () {
    const items = Array.from(this.selected.values());
    this.$chips.innerHTML = items.map(text => `
      <span class="crp-chip">
        <span class="crp-chip__text">${text}</span>
        <button type="button" class="crp-chip__remove" aria-label="Remove ${text}" data-chip="${text}">×</button>
      </span>
    `).join('');
    this.$chips.querySelectorAll('.crp-chip__remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const value = btn.getAttribute('data-chip');
        this.selected.delete(value);
        this.renderList();
        this.renderChips();
        this.syncHiddenInputs();
        this.updateCount();
        this.$input.focus();
      });
    });
    this.updateCount();
  };
  Combobox.prototype.syncHiddenInputs = function () {
    const items = Array.from(this.selected.values());
    this.$hidden.innerHTML = items.map(v => `<input type="hidden" name="conditions" value="${this.escape(v)}">`).join('');
  };
  Combobox.prototype.escape = function (s) {
    const div = document.createElement('div');
    div.innerText = s;
    return div.innerHTML;
  };
  Combobox.prototype.updateCount = function () {
    if (this.$count) this.$count.textContent = this.selected.size.toString();
  };
  Combobox.prototype.isOpen = function () {
    return this.$input.getAttribute('aria-expanded') === 'true';
  };
  Combobox.prototype.open = function () {
    this.$dropdown.hidden = false;
    this.$input.setAttribute('aria-expanded', 'true');
  };
  Combobox.prototype.close = function () {
    this.$dropdown.hidden = true;
    this.$input.setAttribute('aria-expanded', 'false');
    this.activeIndex = -1;
    this.highlightActive();
  };
  Combobox.prototype.updateActiveDescendant = function () {
    const id = this.activeIndex > -1 ? 'opt-' + this.activeIndex : '';
    this.$input.setAttribute('aria-activedescendant', id);
  };
  Combobox.prototype.ensureActiveInView = function () {
    const el = this.$listbox.querySelector('[data-index="' + this.activeIndex + '"]');
    if (!el) return;
    const parent = this.$listbox;
    const elTop = el.offsetTop;
    const elBottom = elTop + el.offsetHeight;
    const viewTop = parent.scrollTop;
    const viewBottom = viewTop + parent.clientHeight;
    if (elTop < viewTop) parent.scrollTop = elTop;else if (elBottom > viewBottom) parent.scrollTop = elBottom - parent.clientHeight;
  };
  Combobox.prototype.highlightActive = function () {
    this.$listbox.querySelectorAll('.crp-combobox__option').forEach((el, i) => {
      el.classList.toggle('is-active', i === this.activeIndex);
    });
  };

  // Init
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-module="crp-combobox"]').forEach(el => new Combobox(el));
  });
})();//# sourceMappingURL=condition-combobox.js.map
