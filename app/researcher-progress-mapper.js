// app/researcher-progress-mapper.js
const express = require('express')
const router = express.Router()

// Explicit map of pages we track
const SECTION = {
  // A — Feasibility
  '/researcher/feasibility/intro':        'feasibility',
  '/researcher/feasibility/demographics': 'feasibility',
  '/researcher/feasibility/medical':      'feasibility',
  '/researcher/feasibility/sites':        'feasibility',
  '/researcher/feasibility/results':      'feasibility',

  // B — Submit a study (8)
  '/researcher/identify-study':           'submit',
  '/researcher/study-info':               'submit',
  '/researcher/study-type':               'submit',
  '/researcher/demographics':             'submit',
  '/researcher/medical':                  'submit',
  '/researcher/sites':                    'submit',
  '/researcher/ethics':                   'submit',
  '/researcher/target-date':              'submit'
}

const TOTALS = { feasibility: 5, submit: 8 }

function ensure(req) {
  const data = req.session.data || (req.session.data = {})
  data.status ||= {}
  const s = (data.progress ||= { sections: {} }).sections
  s.feasibility ||= { completed: 0, total: TOTALS.feasibility }
  s.submit      ||= { completed: 0, total: TOTALS.submit }
  return data
}

// Safer than '*' on Express v5's path-to-regexp: run on all requests
router.use((req, res, next) => {
  const data = ensure(req)
  const path = req.path
  const bucket = SECTION[path]
  if (!bucket) return next()
  if (req.method === 'GET') {
    const cur = (data.status[path] || '').toLowerCase()
    if (!cur || cur === 'not-started') data.status[path] = 'in-progress'
  } else if (req.method === 'POST') {
    data.status[path] = 'completed'
  }
  recompute(data)
  next()
})

function recompute(data) {
  const done = { feasibility: 0, submit: 0 }
  for (const [path, state] of Object.entries(data.status)) {
    const bucket = SECTION[path]
    if (!bucket) continue
    if (String(state).toLowerCase() === 'completed') done[bucket]++
  }
  data.progress.sections.feasibility = { completed: done.feasibility, total: TOTALS.feasibility }
  data.progress.sections.submit      = { completed: done.submit,      total: TOTALS.submit }
}

module.exports = router
