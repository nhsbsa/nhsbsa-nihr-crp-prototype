// app/researcher-volunteer-criteria.js
const express = require('express')
const router = express.Router()
const { recomputeDerived } = require('../../../lib/derived')

router.get('/researcher/volunteer-criteria', (req, res) => {
  const data = req.session.data || (req.session.data = {})
  data.criteria = data.criteria || {}

  // One-time gentle prefill from feasibility
  if (!data._prefilledCriteria) {
    const feas = data.feasibility || {}
    if (feas.defaultAgeRange && !data.criteria.ageRange) data.criteria.ageRange = feas.defaultAgeRange
    if (feas.defaultTravelMiles && !data.criteria.travelMiles) data.criteria.travelMiles = feas.defaultTravelMiles
    data._prefilledCriteria = true
  }

  recomputeDerived(req.session)
  res.render('researcher/volunteer-criteria', { data })
})

router.post('/researcher/volunteer-criteria', (req, res) => {
  const data = req.session.data || (req.session.data = {})
  const body = req.body || {}
  const toArray = v => Array.isArray(v) ? v : (v ? [v] : [])

  data.criteria = Object.assign({}, data.criteria, {
    ageRange: body.ageRange,
    diagnosisRequired: body.diagnosisRequired,
    travelMiles: body.travelMiles,
    availabilityDays: toArray(body.availabilityDays),
    exclusions: toArray(body.exclusions)
  })

  recomputeDerived(req.session)

  if (body._action === 'save-and-continue') return res.redirect('/researcher/preview')
  return res.redirect('/researcher/task-list')
})

module.exports = router
