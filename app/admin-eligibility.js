// app/admin-eligibility.js
// Prototype-only admin review flow for a single study held in session.
//
// Routes:
//  - GET  /admin                         -> dashboard (queue; seeds demo if empty)
//  - GET  /admin/study/review/overview   -> overview with decision + checks
//  - GET  /admin/study/checks            -> single-column checks + decision + notes
//  - POST /admin/study/checks            -> validate, save, PRG redirect to overview
//  - GET  /admin/study/communications    -> log of messages/decisions (read-only)

const express = require('express')
const router = express.Router()

/* ---------------- helpers ---------------- */
function nowGB () { return new Date().toLocaleString('en-GB', { hour12: false }) }

function ensure(req) {
  const data = req.session.data || (req.session.data = {})
  // researcher submission skeletons
  data.submit ||= {}
  data.submit.study ||= {}
  data.submit.info ||= {}
  data.submit.recruitment ||= {}
  data.submit.design ||= {}
  data.submit.sites ||= { list: [] }

  // feasibility and derived numbers
  data.feasibility ||= {}
  data.derived ||= {}

  // admin state
  data.status ||= {}
  data.adminEligibility ||= {}
  data.adminEligibility.platform ||= (data.feasibility.platform || 'JDR')
  data.adminEligibility.rules ||= []
  data.adminEligibility.history ||= [] // {at, by, action, value, meta}
  return data
}

function lastSaved(data) { data.meta ||= {}; data.meta.lastSaved = nowGB() }

/** Seed a demo study if there is no meaningful data. Disabled with env NO_SEED=1 or ?seed=0. */
function seedIfEmpty(req) {
  const data = ensure(req)
  if (process.env.NO_SEED === '1') return
  if (req.query.seed === '0') return
  if (data._seededAdmin) return

  const hasAnything =
    (data.submit.study && (data.submit.study.name || data.submit.study.ciName)) ||
    ((data.submit.sites && data.submit.sites.list && data.submit.sites.list.length > 0)) ||
    (data.adminEligibility && (data.adminEligibility.decision || '').length)

  if (hasAnything) return

  // --- DEMO CONTENT (prototype-only) ---
  data.submit.study = {
    name: 'Example dementia study',
    ciTitle: 'Dr',
    ciName: 'A. Researcher',
    coordinator: { name: 'Sam Patel', email: 'sam.patel@example.org' },
    portfolioStatus: 'yes',
    ethicsApproval: 'no'
  }
  data.submit.recruitment = {
    isOpen: 'yes',
    recruitedToDate: '24',
    startDate: '2025-09-01',
    endDate: '2026-03-31',
    overallTarget: '120'
  }
  data.submit.sites = {
    list: [
      { name: 'Northshire NHS Trust', contactName: 'C. Jones', contactEmail: 'c.jones@northshire.nhs.uk' },
      { name: 'Southvale NHS Trust', contactName: 'M. Green', contactEmail: 'm.green@southvale.nhs.uk' },
      { name: 'Eastbrook NHS Trust', contactName: 'R. Brown', contactEmail: 'r.brown@eastbrook.nhs.uk' }
    ]
  }
  data.submit.info = {
    background: 'We are studying memory changes in adults aged 60+.',
    participants: 'Adults aged 60+ from three NHS sites.',
    whatInvolves: 'Questionnaires and a short clinic visit.'
  }
  data.feasibility = { platform: 'JDR', totalEstimate: '85' }
  data.derived = { matchedEstimate: 52 }
  data._seededAdmin = true

  // Build initial checks
  const snap = computeEligibility(data)
  data.adminEligibility.platform = snap.platform
  data.adminEligibility.rules = snap.rules
  lastSaved(data)
}

/** Compute automated checks snapshot from session. */
function computeEligibility(data) {
  const study    = data.submit.study || {}
  const rec      = data.submit.recruitment || {}
  const matched  = Number((data.derived && data.derived.matchedEstimate) || 0)
  const target   = Number(rec.overallTarget || 0)
  const sites    = (data.submit.sites && data.submit.sites.list) || []
  const info     = data.submit.info || {}

  const rules = []

  // A: population vs target
  if (target > 0) {
    const pct = matched / target
    let status = 'pass'
    let msg = `Feasibility matched ${matched.toLocaleString()} vs target ${target.toLocaleString()} (${Math.round(pct * 100)}%).`
    if (pct < 0.8 && pct >= 0.3) { status = 'warn'; msg += ' Consider site coverage or criteria.' }
    if (pct < 0.3) { status = 'fail'; msg += ' Target likely unrealistic for current criteria.' }
    rules.push({ id: 'pop', label: 'Enough volunteers to meet target', status, message: msg })
  } else {
    rules.push({ id: 'pop', label: 'Enough volunteers to meet target', status: 'warn', message: 'No overall target provided.' })
  }

  // B: ethics if claiming portfolio
  const claimsPortfolio = String(study.portfolioStatus || '').toLowerCase() === 'yes'
  if (claimsPortfolio) {
    const hasEthics = String(study.ethicsApproval || '').toLowerCase() === 'yes'
    rules.push({
      id: 'ethics',
      label: 'Ethics approval recorded',
      status: hasEthics ? 'pass' : 'warn',
      message: hasEthics ? 'Ethics approval recorded.' : 'Portfolio flagged but ethics approval not recorded.'
    })
  } else {
    rules.push({ id: 'ethics', label: 'Ethics approval recorded', status: 'pass', message: 'Not required for this claim.' })
  }

  // C: at least one site
  rules.push({
    id: 'sites',
    label: 'At least 1 study site provided',
    status: sites.length > 0 ? 'pass' : 'fail',
    message: sites.length > 0 ? `${sites.length} site(s) listed.` : 'No sites listed.'
  })

  // D: lay info presence (basic)
  const present = ['background', 'participants', 'whatInvolves'].filter(k => (info[k] || '').trim().length > 0).length
  rules.push({
    id: 'lay',
    label: 'Lay info covers background, participants, activities',
    status: present >= 2 ? 'pass' : 'warn',
    message: `${present}/3 key fields present.`
  })

  return { platform: (data.adminEligibility.platform || data.feasibility.platform || 'JDR'), rules }
}

/* -------- tiny flash (PRG) -------- */
function setFlash(req, payload) { const d = ensure(req); d._flash = payload }
function pullFlash(req) { const d = ensure(req); const f = d._flash; delete d._flash; return f || null }

/* ---------------- routes ---------------- */

// Dashboard (queue)
router.get('/admin', (req, res) => {
  seedIfEmpty(req)
  const data = ensure(req)

  // Build the “queue” row from session
  const study = data.submit.study || {}
  const item = {
    name: study.name || 'Untitled study',
    platform: data.adminEligibility.platform || 'JDR',
    decision: data.adminEligibility.decision || '',
    updated: (data.meta && data.meta.lastSaved) || '—'
  }

  // Empty state if someone disables seeding and still has nothing
  const isEmpty = !item.name && !item.decision && item.updated === '—'
  res.render('admin/dashboard.html', { activeNav: 'admin', item, isEmpty })
})

// Legacy aliases
router.get('/admin/study/review', (req, res) => res.redirect(302, '/admin/study/review/overview'))
router.get('/admin/study/review/', (req, res) => res.redirect(302, '/admin/study/review/overview'))

// Overview
router.get('/admin/study/review/overview', (req, res) => {
  const data = ensure(req)
  if (!data.adminEligibility.rules.length) {
    const snap = computeEligibility(data)
    data.adminEligibility.platform = snap.platform
    data.adminEligibility.rules = snap.rules
    lastSaved(data)
  }
  const flash = pullFlash(req)
  res.render('admin/review-overview.html', {
    activeNav: 'admin',
    data,
    platform: data.adminEligibility.platform || 'JDR',
    rules: data.adminEligibility.rules,
    decision: data.adminEligibility.decision || '',
    notesForResearcher: data.adminEligibility.notesForResearcher || '',
    history: data.adminEligibility.history || [],
    flash
  })
})

// Review (single column)
router.get('/admin/study/checks', (req, res) => {
  const data = ensure(req)
  if (!data.adminEligibility.rules.length) {
    const snap = computeEligibility(data)
    data.adminEligibility.platform = snap.platform
    data.adminEligibility.rules = snap.rules
    lastSaved(data)
  }
  const flash = pullFlash(req)
  res.render('admin/review.html', {
    activeNav: 'admin',
    data,
    platform: data.adminEligibility.platform || 'JDR',
    rules: data.adminEligibility.rules,
    decision: data.adminEligibility.decision || '',
    notesInternal: data.adminEligibility.notesInternal || '',
    notesForResearcher: data.adminEligibility.notesForResearcher || '',
    errors: null,
    flash
  })
})

// Save review (validation + PRG)
router.post('/admin/study/checks', (req, res) => {
  const data = ensure(req)
  const b = req.body || {}

  // Update rule statuses
  const current = data.adminEligibility.rules || []
  const byId = Object.fromEntries(current.map(r => [r.id, r]))
  Object.keys(b).filter(k => k.startsWith('ruleStatus_')).forEach(k => {
    const id = k.replace('ruleStatus_', '')
    if (byId[id]) byId[id].status = b[k]
  })
  data.adminEligibility.rules = Object.values(byId).length ? Object.values(byId) : current

  const decision = b.decision || ''
  const notesInternal = b.notesInternal || ''
  const notesForResearcher = b.notesForResearcher || ''

  // Validation
  const errors = []
  if (!decision) errors.push({ href: '#decision', text: 'Select an overall decision' })
  const hasFail = data.adminEligibility.rules.some(r => r.status === 'fail')
  const hasWarn = data.adminEligibility.rules.some(r => r.status === 'warn')
  if (decision === 'eligible' && hasFail) {
    errors.push({ href: '#decision', text: 'You cannot mark as eligible while any check is set to Fail' })
  }
  if ((hasWarn || hasFail) && !notesForResearcher.trim()) {
    errors.push({ href: '#notesForResearcher', text: 'Add a message to the researcher for items that need attention' })
  }

  if (errors.length) {
    return res.render('admin/review.html', {
      activeNav: 'admin',
      data,
      platform: data.adminEligibility.platform || 'JDR',
      rules: data.adminEligibility.rules,
      decision,
      notesInternal,
      notesForResearcher,
      errors,
      flash: null
    })
  }

  // Persist
  const beforeDecision = data.adminEligibility.decision || ''
  data.adminEligibility.decision = decision
  data.adminEligibility.notesInternal = notesInternal
  data.adminEligibility.notesForResearcher = notesForResearcher
  lastSaved(data)

  // status + history
  data.status.adminReview = decision
  const who = (data.user && data.user.email) || 'admin.user'
  if (beforeDecision !== decision) {
    data.adminEligibility.history.push({ at: nowGB(), by: who, action: 'decision', value: decision })
  }
  if (notesForResearcher.trim()) {
    data.adminEligibility.history.push({ at: nowGB(), by: who, action: 'message', value: notesForResearcher })
  }

  setFlash(req, { type: 'success', heading: 'Saved', text: 'Eligibility checks, decision and notes recorded.' })
  return res.redirect(303, '/admin/study/review/overview')
})

// Communications log (read-only)
router.get('/admin/study/communications', (req, res) => {
  const data = ensure(req)
  const history = (data.adminEligibility && data.adminEligibility.history) || []
  res.render('admin/communications.html', { activeNav: 'admin', history })
})

module.exports = router
