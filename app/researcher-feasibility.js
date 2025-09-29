// app/researcher-feasibility.js
const express = require('express')
const router = express.Router()
const { recomputeDerived } = require('../lib/derived')

// Helper to turn min/max into a width factor (smaller band = fewer people)
function ageFactorFromSelection(ageRange, minVal, maxVal) {
  // Default reference band is 18–65 (width 47) → factor ~0.6
  const REF_MIN = 18, REF_MAX = 65, REF_WIDTH = REF_MAX - REF_MIN
  if (ageRange !== 'Custom') {
    if (ageRange === '18-65') return 0.60
    if (ageRange === '25-60') return 0.45
    if (ageRange === '30-55') return 0.35
    return 0.30 // any other preset, just be stricter
  }
  let min = Number(minVal), max = Number(maxVal)
  if (!isFinite(min) || !isFinite(max) || min < 0 || max < min) return 0.30
  const width = Math.max(0, max - min)
  // Scale relative to reference width, capped between 0.15 and 0.65
  const scaled = 0.60 * (width / REF_WIDTH)
  return Math.min(0.65, Math.max(0.15, scaled || 0.15))
}

// rough, deterministic feasibility estimate
function calcFeasTotal(feas = {}) {
  let base = 100000 // pretend registry pool

  // Platform impact (JDR narrower audience)
  const platform = (feas.platform || 'BPOR').toUpperCase()
  if (platform === 'JDR') base *= 0.7

  // Demographics
  const demo = feas.demographics || {}
  const ageRange = demo.ageRange || '18-65'
  const ageF = ageFactorFromSelection(ageRange, demo.customAgeMin, demo.customAgeMax)
  base *= ageF

  const sex = demo.sex || 'any'
  if (sex !== 'any') base *= 0.5

  const regions = Array.isArray(demo.regions) ? demo.regions.length : 0
  if (regions > 0) base *= Math.min(1, regions * 0.15) // 15% per region up to 100%

  // Medical
  const med = feas.medical || {}
  const conds = Array.isArray(med.conditions) ? med.conditions.length : 0
  if (conds > 0) base *= Math.max(0.05, 0.25 / conds)

  // Confirmed requirement (JDR => true)
  const confirmedOnly = !!med.confirmedOnly || platform === 'JDR'
  if (confirmedOnly) base *= 0.6

  // Sites (coverage proxy)
  const sites = Array.isArray(feas.sites) ? feas.sites.length : 0
  if (sites > 0) base *= Math.min(1, sites * 0.2)

  return Math.max(0, Math.round(base))
}

// INTRO
router.get('/researcher/feasibility/intro', (req, res) => {
  const data = req.session.data || (req.session.data = {})
  data.feasibility = data.feasibility || {}
  if (!data.feasibility.platform) data.feasibility.platform = 'BPOR'
  if (!data.feasibility.targetRecruitment) data.feasibility.targetRecruitment = ''
  res.render('researcher/feasibility/intro', { data })
})

router.post('/researcher/feasibility/intro', (req, res) => {
  const data = req.session.data || (req.session.data = {})
  const body = req.body || {}
  data.feasibility = data.feasibility || {}
  data.feasibility.platform = (body.platform || 'BPOR').toUpperCase()
  data.feasibility.targetRecruitment = String(body.targetRecruitment || '').trim()
  res.redirect('/researcher/feasibility/demographics')
})

// DEMOGRAPHICS (captures custom min/max)
router.get('/researcher/feasibility/demographics', (req, res) => {
  const data = req.session.data || (req.session.data = {})
  data.feasibility = data.feasibility || {}
  res.render('researcher/feasibility/demographics', { data })
})

router.post('/researcher/feasibility/demographics', (req, res) => {
  const data = req.session.data || (req.session.data = {})
  const body = req.body || {}
  const toArray = v => Array.isArray(v) ? v : (v ? [v] : [])
  const ageRange = body.ageRange || '18-65'
  const customAgeMin = body.customAgeMin ? Number(body.customAgeMin) : ''
  const customAgeMax = body.customAgeMax ? Number(body.customAgeMax) : ''

  data.feasibility = data.feasibility || {}
  data.feasibility.demographics = {
    ageRange,
    customAgeMin: ageRange === 'Custom' ? customAgeMin : '',
    customAgeMax: ageRange === 'Custom' ? customAgeMax : '',
    sex: body.sex || 'any',
    regions: toArray(body.regions)
  }
  res.redirect('/researcher/feasibility/medical')
})

// MEDICAL (JDR = confirmed required)
router.get('/researcher/feasibility/medical', (req, res) => {
  const data = req.session.data || (req.session.data = {})
  data.feasibility = data.feasibility || {}
  res.render('researcher/feasibility/medical', { data })
})

router.post('/researcher/feasibility/medical', (req, res) => {
  const data = req.session.data || (req.session.data = {})
  data.feasibility = data.feasibility || {}
  const body = req.body || {}
  const toArray = v => Array.isArray(v) ? v : (v ? [v] : [])

  const platform = (data.feasibility.platform || 'BPOR').toUpperCase()
  const confirmedOnly = platform === 'JDR' ? true : (body.confirmedOnly === 'yes')

  data.feasibility.medical = {
    conditions: toArray(body.conditions),
    confirmedOnly
  }
  res.redirect('/researcher/feasibility/sites')
})

// SITES
router.get('/researcher/feasibility/sites', (req, res) => {
  const data = req.session.data || (req.session.data = {})
  data.feasibility = data.feasibility || {}
  res.render('researcher/feasibility/sites', { data })
})
// FEASIBILITY: SITES (POST)
router.post('/researcher/feasibility/sites', (req, res) => {
  const data = req.session.data || (req.session.data = {})
  data.feasibility = data.feasibility || {}

  const body = req.body || {}
  // Normalise all field groups to arrays
  const toArray = v => Array.isArray(v) ? v : (typeof v === 'undefined' ? [] : [v])

  const codes  = toArray(body.siteCode).map(v => String(v || '').trim())
  const names  = toArray(body.siteName).map(v => String(v || '').trim())
  const radii  = toArray(body.radiusMiles).map(v => Math.max(0, Number(v || 0)))
  const modes  = toArray(body.mode).map(v => (v || 'onsite'))

  const rows = []
  for (let i = 0; i < Math.max(codes.length, names.length, radii.length, modes.length); i++) {
    const siteCode = codes[i] || ''
    if (!siteCode) continue // skip empty rows
    rows.push({
      siteCode,
      siteName: names[i] || '',
      radiusMiles: isFinite(radii[i]) ? radii[i] : 10,
      mode: modes[i] || 'onsite'
    })
  }

  data.feasibility.sites = rows
  res.redirect('/researcher/feasibility/results')
})

// RESULTS
router.get('/researcher/feasibility/results', (req, res) => {
  const data = req.session.data || (req.session.data = {})
  data.feasibility = data.feasibility || {}
  data.feasibility.totalEstimate = calcFeasTotal(data.feasibility)
  recomputeDerived(req.session)
  res.render('researcher/feasibility/results', { data })
})

// RESULTS (POST) — force-complete feasibility section
router.post('/researcher/feasibility/results', (req, res) => {
  const data = req.session.data || (req.session.data = {})
  data.feasibility = data.feasibility || {}

  // Recalculate and mark as completed
  data.feasibility.totalEstimate = calcFeasTotal(data.feasibility)
  data.feasibility.completed = true

  // Force-complete each feasibility path so counters and tags are in sync
  data.status = data.status || {}
  const FEAS_PATHS = [
    '/researcher/feasibility/intro',
    '/researcher/feasibility/demographics',
    '/researcher/feasibility/medical',
    '/researcher/feasibility/sites',
    '/researcher/feasibility/results'
  ]
  FEAS_PATHS.forEach(p => { data.status[p] = 'completed' })

  // Optional: stamp last saved (belt-and-braces)
  data.meta = data.meta || {}
  data.meta.lastSaved = new Date().toLocaleString('en-GB', { hour12: false })

  recomputeDerived(req.session)
  res.redirect('/researcher/task-list')
})


module.exports = router
