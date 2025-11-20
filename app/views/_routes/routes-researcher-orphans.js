// app/routes-researcher-orphans.js
// Prototype-only: catch orphaned POSTs from placeholder views and return users
// to the researcher task list with a "last saved" stamp. No real validation.

const express = require('express')
const router = express.Router()

function saveStamp (req) {
  req.session.data = req.session.data || {}
  req.session.data.meta = req.session.data.meta || {}
  req.session.data.meta.lastSaved = new Date().toLocaleString('en-GB', { hour12: false })
}

// Health criteria (placeholder) -> stash minimal flag and bounce to task list
router.post('/researcher/health-criteria', (req, res) => {
  req.session.placeholder = req.session.placeholder || {}
  req.session.placeholder.healthCriteria = true
  saveStamp(req)
  return res.redirect('/researcher/task-list')
})

// Manual details (placeholder) -> stash minimal flag and bounce to task list
router.post('/researcher/manual-details', (req, res) => {
  req.session.placeholder = req.session.placeholder || {}
  req.session.placeholder.manualDetails = true
  saveStamp(req)
  return res.redirect('/researcher/task-list')
})

module.exports = router
