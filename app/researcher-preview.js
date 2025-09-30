// app/researcher-preview.js
const express = require('express')
const router = express.Router()

function ensure(req) {
  return (req.session.data ||= {})
}

// helper to prefer first non-empty value
const pick = (...cands) => cands.find(v => v !== undefined && v !== null && v !== '')

// GET: preview
router.get('/researcher/preview', (req, res) => {
  const data = ensure(req)

  // Flatten likely sources into a single VM for convenience
  const vm = {}

  // Study identifiers/info
  const id = data.identify || {}
  const sub = data.submission || {}
  const studyInfo = sub.studyInfo || data.study || {}
  vm.cpmsId = pick(id.cpmsId, studyInfo.cpmsId)
  vm.irasId = pick(id.irasId, studyInfo.irasId)
  vm.title  = pick(studyInfo.title, id.title)
  vm.laySummary = pick(studyInfo.laySummary, id.laySummary)
  vm.sponsor = studyInfo.sponsor

  // Criteria from the canonical submission criteria or feasibility fallbacks
  const crit = data.criteria || {}
  const demo = crit.demographics || (data.feasibility && data.feasibility.demographics) || (sub.demographics) || {}
  const med  = crit.medical       || (data.feasibility && data.feasibility.medical)       || (sub.medical)       || {}
  const sites = sub.sites || (data.feasibility && data.feasibility.sites) || {}

  vm.demographics = {
    sex: pick(demo.sex, 'any'),
    ageMode: pick(demo.ageMode, 'any'),
    ageMin: demo.ageMin,
    ageMax: demo.ageMax,
    regions: demo.regions || []
  }
  vm.medical = {
    conditions: med.conditions || [],
    confirmation: med.confirmation || 'either'
  }
  vm.sites = {
    codes: sites.codes || [],
    scope: sites.scope || 'any'
  }

  // Feasibility / estimates
  const feas = data.feasibility || {}
  const derived = data.derived || {}
  vm.matchedEstimate = pick(derived.matchedEstimate, 0)
  vm.totalEstimate   = pick(feas.totalEstimate, 0)

  // Study type and target date
  vm.studyType = sub.studyType || {}
  vm.targetDate = sub.targetDate || {}

  // Ethics
  vm.ethics = sub.ethics || {}

  // Expose vm to the template while keeping legacy `data` available
  res.render('researcher/preview.html', { data, vm, activeNav: 'create-request' })
})

module.exports = router
