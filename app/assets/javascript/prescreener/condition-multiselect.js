/* public/js/prescreener/condition-multiselect.js */
/* eslint-disable */
(function () {
  function fetchJSON (url) {
    return fetch(url, { headers: { 'Accept': 'application/json' } }).then(r => {
      if (!r.ok) throw new Error('Failed to load ' + url + ' -> ' + r.status)
      return r.json()
    })
  }

  function normalise (s) { return (s || '').toString().toLowerCase() }

  function templateOption (text, i, checked, active) {
    return `
      <li id="opt-${i}" class="crp-combobox__option ${active ? 'is-active' : ''}"
          role="option" aria-selected="${checked ? 'true' : 'false'}" data-index="${i}">
        <span class="crp-combobox__checkbox" aria-hidden="true">
          <input type="checkbox" tabindex="-1" ${checked ? 'checked' : ''}/>
        </span>
        <span class="crp-combobox__text">${text}</span>
      </li>`
  }

  function templateChip (text) {
    return `
      <span class="crp-chip">
        <span class="crp-chip__text">${text}</span>
        <button type="button" class="crp-chip__remove" aria-label="Remove ${text}" data-chip="${text}">×</button>
      </span>`
  }

  function ConditionMultiselect (cfg) {
    this.$input    = document.querySelector(cfg.input)
    this.$listbox  = document.querySelector(cfg.listbox)
    this.$dropdown = document.querySelector(cfg.dropdown)
    this.$chips    = document.querySelector(cfg.chips)
    this.$hidden   = document.querySelector(cfg.hidden)
    this.$count    = document.querySelector(cfg.count)

    // Panel container lets us find an empty-state even if it's not inside chips
    this.$panel = cfg.panel ? document.querySelector(cfg.panel) : null
    if (!this.$panel && this.$chips) {
      // nearest ".crp-selected" or the chips' parent as a fallback
      this.$panel = this.$chips.closest('.crp-selected') || this.$chips.parentElement
    }

    // Find an empty-state element in several sensible places
    this.$empty =
      (cfg.empty && document.querySelector(cfg.empty)) ||
      (this.$chips && this.$chips.querySelector('.crp-empty')) ||
      (this.$panel && this.$panel.querySelector('.crp-empty')) ||
      document.getElementById('selected-empty') || null

    this.source = cfg.source

    this.all = []            // array of strings
    this.filtered = []
    this.selected = new Set((window.CRPDATA && window.CRPDATA.selected) || [])

    this.activeIndex = -1
    this.bindBase()
    this.load()
  }

  ConditionMultiselect.prototype.load = function () {
    fetchJSON(this.source).then(json => {
      // Accept either [{name:..}, ..] or ["..", ".."]
      this.all = json.map(item => typeof item === 'string' ? item : item.name)
      this.filtered = this.all.slice(0)
      this.render()
    }).catch(err => {
      console.error('[conditions] ' + err.message)
      this.all = []
      this.filtered = []
      this.render()
    })
  }

  ConditionMultiselect.prototype.bindBase = function () {
    var self = this

    this.$input.addEventListener('focus', function () {
      self.open()
    })

    this.$input.addEventListener('input', function () {
      var q = normalise(self.$input.value)
      self.filtered = self.all.filter(c => normalise(c).includes(q))
      self.activeIndex = self.filtered.length ? 0 : -1
      self.open()
      self.renderList()
    })

    this.$input.addEventListener('keydown', function (e) {
      var key = e.key
      if (!self.isOpen() && (key === 'ArrowDown' || key === 'ArrowUp')) self.open()
      if (key === 'ArrowDown') {
        e.preventDefault(); self.move(1)
      } else if (key === 'ArrowUp') {
        e.preventDefault(); self.move(-1)
      } else if (key === 'Enter' || key === ' ') {
        if (self.isOpen() && self.activeIndex > -1) { e.preventDefault(); self.toggleActive() }
      } else if (key === 'Escape') {
        self.close()
      }
    })

    document.addEventListener('click', function (e) {
      if (!e.target.closest('.crp-combobox')) self.close()
    })

    this.$listbox.addEventListener('click', function (e) {
      var item = e.target.closest('[data-index]')
      if (!item) return
      self.activeIndex = parseInt(item.getAttribute('data-index'), 10)
      self.toggleActive()
      self.$input.focus()
    })
  }

  ConditionMultiselect.prototype.move = function (delta) {
    var max = this.filtered.length - 1
    if (max < 0) return
    this.activeIndex = Math.max(0, Math.min(max, this.activeIndex + delta))
    this.$input.setAttribute('aria-activedescendant', 'opt-' + this.activeIndex)
    this.highlightActive()
    this.ensureActiveInView()
  }

  ConditionMultiselect.prototype.toggleActive = function () {
    var item = this.filtered[this.activeIndex]
    if (!item) return
    if (this.selected.has(item)) this.selected.delete(item)
    else this.selected.add(item)
    this.render()
  }

  ConditionMultiselect.prototype.render = function () {
    this.renderList()
    this.renderChips()
    this.syncHidden()
    this.updateCount()
  }

  ConditionMultiselect.prototype.renderList = function () {
    var html = this.filtered.map((t, i) => templateOption(t, i, this.selected.has(t), i === this.activeIndex)).join('')
    this.$listbox.innerHTML = html || '<li class="crp-combobox__empty">No results</li>'
  }

  ConditionMultiselect.prototype.renderChips = function () {
    var items = Array.from(this.selected.values())
    this.$chips.innerHTML = items.map(templateChip).join('')

    // Robust empty-state toggle (inside chips, or elsewhere in the panel)
    if (this.$empty) {
      this.$empty.style.display = items.length ? 'none' : ''
      // If the empty element is meant to sit inside the chips container, keep it there
      if (this.$chips && !this.$chips.contains(this.$empty) && this.$empty.closest('.crp-selected') === this.$chips.closest('.crp-selected')) {
        this.$chips.prepend(this.$empty)
      }
    }

    var self = this
    this.$chips.querySelectorAll('.crp-chip__remove').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var value = btn.getAttribute('data-chip')
        self.selected.delete(value)
        self.render()
        self.$input.focus()
      })
    })
  }

  ConditionMultiselect.prototype.syncHidden = function () {
    var items = Array.from(this.selected.values())
    this.$hidden.innerHTML = items.map(val => `<input type="hidden" name="conditions" value="${escapeHTML(val)}">`).join('')
  }

  ConditionMultiselect.prototype.updateCount = function () {
    if (this.$count) this.$count.textContent = this.selected.size.toString()
  }

  ConditionMultiselect.prototype.isOpen = function () {
    return this.$input.getAttribute('aria-expanded') === 'true'
  }
  ConditionMultiselect.prototype.open = function () {
    this.$dropdown.hidden = false
    this.$input.setAttribute('aria-expanded', 'true')
  }
  ConditionMultiselect.prototype.close = function () {
    this.$dropdown.hidden = true
    this.$input.setAttribute('aria-expanded', 'false')
    this.activeIndex = -1
    this.highlightActive()
  }

  ConditionMultiselect.prototype.highlightActive = function () {
    this.$listbox.querySelectorAll('.crp-combobox__option').forEach((el, i) => {
      el.classList.toggle('is-active', i === this.activeIndex)
    })
  }

  ConditionMultiselect.prototype.ensureActiveInView = function () {
    var el = this.$listbox.querySelector('[data-index="' + this.activeIndex + '"]')
    if (!el) return
    var parent = this.$listbox
    var top = el.offsetTop
    var bottom = top + el.offsetHeight
    var viewTop = parent.scrollTop
    var viewBottom = viewTop + parent.clientHeight
    if (top < viewTop) parent.scrollTop = top
    else if (bottom > viewBottom) parent.scrollTop = bottom - parent.clientHeight
  }

  function escapeHTML (s) {
    var d = document.createElement('div'); d.innerText = s; return d.innerHTML
  }

  window.initConditionMultiselect = function (cfg) {
    new ConditionMultiselect(cfg)
  }
})()
