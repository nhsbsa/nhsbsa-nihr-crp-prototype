// app/researcher-progress-mapper.js
const express = require('express')
const router = express.Router()

// Map each route path to a section bucket
const SECTION = {
  // -------- Phase A — Feasibility --------
  '/researcher/feasibility/platform':             'feasibility', // NEW
  '/researcher/feasibility/target':               'feasibility', // NEW
  '/researcher/feasibility/intro':                'feasibility',
  '/researcher/feasibility/sites':                'feasibility',
  '/researcher/feasibility/diagnoses':            'feasibility',
  '/researcher/feasibility/demographics':         'feasibility',
  '/researcher/feasibility/demographics-extended':'feasibility',
  '/researcher/feasibility/medical':              'feasibility',
  '/researcher/feasibility/disabilities':         'feasibility',
  '/researcher/feasibility/other':                'feasibility',
  '/researcher/feasibility/results':              'feasibility',

  // -------- Phase B — Submit a study --------
  '/researcher/identify-study':                   'submit',
  '/researcher/study-info':                       'submit',
  '/researcher/study-type':                       'submit',
  '/researcher/demographics':                     'submit',
  '/researcher/medical':                          'submit',
  '/researcher/sites':                            'submit',
  '/researcher/ethics':                           'submit',
  '/researcher/volunteer-criteria':               'submit',
  '/researcher/target-date':                      'submit'
}

// Totals reflect the items you actually show in the task list
const SECTION_TOTALS = {
  feasibility: 11, // platform + target + 9 existing steps (intro optional but mapped)
  submit: 8
}

function ensure(req) {
  const data = req.session.data || (req.session.data = {})
  data.status ||= {}
  data.meta ||= {}
  data.progress ||= { sections: {} }
  data.progress.sections.feasibility ||= { completed: 0, total: SECTION_TOTALS.feasibility }
  data.progress.sections.submit      ||= { completed: 0, total: SECTION_TOTALS.submit }
  return data
}

// Mark GET as in-progress unless already completed
router.get('*', (req, res, next) => {
  const data = ensure(req)
  const path = req.path
  const bucket = SECTION[path]
  if (!bucket) return next()

  const current = data.status[path]
  if (!current || current === 'not-started') data.status[path] = 'in-progress'
  recomputeCounters(data)
  next()
})

// Mark POST as completed and stamp lastSaved
router.post('*', (req, res, next) => {
  const data = ensure(req)
  const path = req.path
  const bucket = SECTION[path]
  if (!bucket) return next()

  data.status[path] = 'completed'
  data.meta.lastSaved = new Date().toLocaleString('en-GB', { hour12: false })
  recomputeCounters(data)
  next()
})

function recomputeCounters(data) {
  const bySection = { feasibility: 0, submit: 0 }
  for (const [path, state] of Object.entries(data.status)) {
    const bucket = SECTION[path]
    if (!bucket) continue
    if (String(state).toLowerCase() === 'completed') bySection[bucket]++
  }

  const sec = data.progress.sections
  if (sec.feasibility) {
    sec.feasibility.total = SECTION_TOTALS.feasibility
    sec.feasibility.completed = bySection.feasibility
  }
  if (sec.submit) {
    sec.submit.total = SECTION_TOTALS.submit
    sec.submit.completed = bySection.submit
  }
}

module.exports = router
