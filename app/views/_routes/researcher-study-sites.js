// app/researcher-study-sites.js
// B5: Study sites (prototype-only). Aligns with preview by writing to data.submit.sites

const express = require('express')
const router = express.Router()

function nowGB () {
  return new Date().toLocaleString('en-GB', { hour12: false })
}

function ensure(req) {
  const data = req.session.data || (req.session.data = {})
  data.meta ||= {}
  data.status ||= {}
  data.feasibility ||= {}
  data.feasibility.sites ||= { list: [] }

  data.submit ||= {}
  // Canonical location used by preview and submission
  data.submit.sites ||= { list: [] }

  return data
}

// If feasibility had sites, use them to hydrate the editable list
function hydrateFromFeasibility (data) {
  const f = data.feasibility || {}
  const fSites = f.sites || {}
  const target = data.submit.sites

  // Only hydrate on first visit or when list is empty
  if (!target.list || !target.list.length) {
    if (fSites.list && fSites.list.length) {
      target.list = fSites.list.map((s, i) => ({
        name: String(s.name || `Site ${i + 1}`).trim(),
        // PI fields are not collected in this prototype
        contactName: '',
        contactEmail: '',
        coverage: s.coverage || (s.radius ? { type: 'radius', miles: s.radius } : undefined)
      }))
      data.status['/researcher/study-sites'] = 'in-progress'
      data.meta.lastSaved = nowGB()
    } else {
      target.list = []
    }
  }
}

router.get('/researcher/study-sites', (req, res) => {
  const data = ensure(req)
  hydrateFromFeasibility(data)
  res.render('researcher/study-sites.html', {
    activeNav: 'create-request',
    data,
    model: data.submit.sites,
    errors: []
  })
})

router.post('/researcher/study-sites', (req, res) => {
  const data = ensure(req)
  const b = req.body || {}
  const list = data.submit.sites.list

  // Remove a row by index
  if (b.removeIndex !== undefined && b.removeIndex !== '') {
    const idx = parseInt(String(b.removeIndex), 10)
    if (Number.isInteger(idx) && idx >= 0 && idx < list.length) {
      list.splice(idx, 1)
    }
  }

  // Add a fresh site row
  if (b.addSite === 'yes') {
    const name = String(b.name || '').trim()
    const contactName = String(b.contactName || '').trim()
    const contactEmail = String(b.contactEmail || '').trim()

    if (name || contactName || contactEmail) {
      list.push({
        name: name || `Site ${list.length + 1}`,
        contactName,
        contactEmail
      })
    }
  }

  // Persist edits to existing rows
  if (Array.isArray(b.list)) {
    data.submit.sites.list = b.list.map((r, i) => ({
      name: String(r.name || `Site ${i + 1}`).trim(),
      // PI fields remain removed
      contactName: String(r.contactName || '').trim(),
      contactEmail: String(r.contactEmail || '').trim(),
      coverage: r.coverage
    }))
  }

  data.status['/researcher/study-sites'] = list.length ? 'completed' : 'in-progress'
  data.meta.lastSaved = nowGB()
  res.redirect('/researcher/task-list')
})

module.exports = router
