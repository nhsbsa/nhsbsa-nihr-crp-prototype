// app/routes-admin-studies.js
const express = require('express')
const router = express.Router()

// Status constants
const STATUSES = ['Submitted', 'In review', 'Approved', 'Rejected', 'Live', 'Changes requested']

// Helper: get or init admin store
function getAdminStore(req) {
  if (!req.session.adminStudies) req.session.adminStudies = {}
  return req.session.adminStudies
}

// Merge researcher submissions with admin status store
function listStudies(req) {
  const subs = req.session.submissions || []
  const admin = getAdminStore(req)
  return subs.map(s => {
    const adm = admin[s.id] || { status: 'Submitted', history: [] }
    return {
      ...s,
      adminStatus: adm.status,
      history: adm.history
    }
  })
}

function ensureStudy(req, id) {
  const items = listStudies(req)
  return items.find(x => x.id === id) || null
}

function pushHistory(req, id, entry) {
  const admin = getAdminStore(req)
  if (!admin[id]) admin[id] = { status: 'Submitted', history: [] }
  admin[id].history.unshift({ at: new Date().toISOString(), ...entry })
}

// ---------- List ----------
router.get('/admin/studies', (req, res) => {
  const q = (req.query.q || '').toLowerCase()
  const status = req.query.status || 'All'
  let items = listStudies(req)

  if (q) {
    items = items.filter(i => {
      const title = i.meta?.title || i.details?.shortName || ''
      return title.toLowerCase().includes(q) || String(i.id).toLowerCase().includes(q)
    })
  }
  if (status !== 'All') {
    items = items.filter(i => i.adminStatus === status)
  }

  // Basic counts
  const counts = {
    Submitted: items.filter(i => i.adminStatus === 'Submitted').length,
    'In review': items.filter(i => i.adminStatus === 'In review').length,
    Approved: items.filter(i => i.adminStatus === 'Approved').length,
    Rejected: items.filter(i => i.adminStatus === 'Rejected').length,
    Live: items.filter(i => i.adminStatus === 'Live').length,
    'Changes requested': items.filter(i => i.adminStatus === 'Changes requested').length,
  }

  res.render('admin/studies/index', { items, q, status, counts, STATUSES })
})

// ---------- Detail ----------
router.get('/admin/studies/:id', (req, res) => {
  const item = ensureStudy(req, req.params.id)
  if (!item) return res.redirect('/admin/studies')
  res.render('admin/studies/show', { item, STATUSES })
})

// ---------- Actions ----------
router.post('/admin/studies/:id/action', (req, res) => {
  const { action, message = '' } = req.body || {}
  const id = req.params.id
  const admin = getAdminStore(req)
  if (!admin[id]) admin[id] = { status: 'Submitted', history: [] }

  switch (action) {
    case 'start-review':
      admin[id].status = 'In review'
      pushHistory(req, id, { event: 'Review started' })
      break
    case 'approve':
      admin[id].status = 'Approved'
      pushHistory(req, id, { event: 'Approved', note: message })
      break
    case 'reject':
      admin[id].status = 'Rejected'
      pushHistory(req, id, { event: 'Rejected', note: message })
      break
    case 'request-changes':
      admin[id].status = 'Changes requested'
      pushHistory(req, id, { event: 'Changes requested', note: message })
      break
    case 'make-live':
      admin[id].status = 'Live'
      pushHistory(req, id, { event: 'Marked live' })
      break
  }
  res.redirect('/admin/studies/' + id)
})

// ---------- Bulk ----------
router.post('/admin/studies/bulk', (req, res) => {
  const ids = [].concat(req.body.ids || []).filter(Boolean)
  const action = req.body.action
  const admin = getAdminStore(req)

  ids.forEach(id => {
    if (!admin[id]) admin[id] = { status: 'Submitted', history: [] }
    if (action === 'approve-selected') {
      admin[id].status = 'Approved'
      pushHistory(req, id, { event: 'Approved (bulk)' })
    } else if (action === 'reject-selected') {
      admin[id].status = 'Rejected'
      pushHistory(req, id, { event: 'Rejected (bulk)' })
    }
  })
  res.redirect('/admin/studies')
})

module.exports = router
