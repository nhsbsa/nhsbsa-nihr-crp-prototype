// app/mw-criteria-bridge.js
const express = require('express')
const router = express.Router()

function ensure(req) {
  const data = req.session.data || (req.session.data = {})
  data.criteria ||= {}
  return data
}

// Backfill criteria.demographics once, from feasibility if present
router.use((req, res, next) => {
  const data = ensure(req)
  const c = data.criteria
  const f = data.feasibility || {}
  const s = data.submission || {}

  if (!c.demographics) {
    c.demographics = f.demographics || s.demographics || {}
  }

  // Make it easy for templates to find
  res.locals.data = data
  next()
})

module.exports = router
