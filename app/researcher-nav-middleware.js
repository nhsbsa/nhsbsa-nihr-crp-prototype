// app/researcher-nav-middleware.js
const express = require('express')
const router = express.Router()

const SUBMIT_SECTIONS = [
  'identify-study',
  'study-information',
  'study-type',
  'demographics',
  'medical',
  'sites',
  'matching-criteria',
  'target-date',
  'preview',
  'check-answers'
]

const FEAS_SECTIONS = [
  'feas-intro',
  'feas-demographics',
  'feas-medical',
  'feas-sites',
  'feas-results'
]

router.use((req, res, next) => {
  const data = req.session.data || (req.session.data = {})
  data.taskStatus = data.taskStatus || {}
  data.meta = data.meta || {}

  res.locals.activeNav = 'study-mgmt'

  const list = req.path.startsWith('/researcher/feasibility') ? FEAS_SECTIONS : SUBMIT_SECTIONS
  const completed = list.reduce((n, k) => n + (data.taskStatus[k] === 'completed' ? 1 : 0), 0)

  res.locals.progress = {
    sections: list,
    completed,
    total: list.length,
    lastSaved: data.meta.lastSaved || null
  }

  next()
})

module.exports = router
