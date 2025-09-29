// app/mw-hydrate-submit.js
const express = require('express')
const router = express.Router()

// Conservative blank check
const isBlank = v => v === undefined || v === null || (typeof v === 'string' && v.trim() === '')
const asArray = v => Array.isArray(v) ? v : (isBlank(v) ? [] : [v])
const uniq = list => Array.from(new Set(asArray(list).map(s => String(s).trim()).filter(Boolean)))

function hydrate(data) {
  data.submit ||= {}
  const S = data.submit
  const F = data.feasibility || {}
  const FeasDemo = F.demographics || F.cohort || F.filters || {}
  const FeasMed  = F.medical || F.conditions || {}
  const FeasSites = (F.sites && (F.sites.siteCodes || F.sites.codes)) || F.siteCodes || F.sites || []

  let changed = false

  // Study info (from identify study)
  if (!S.studyInfo && data.study && data.study.identify) {
    const id = data.study.identify
    S.studyInfo = {
      title: id.title || '',
      laySummary: id.laySummary || '',
      cpmsId: id.cpmsId || '',
      irasId: id.irasId || ''
    }
    changed = true
  }

  // Demographics
  S.demographics ||= {}
  const D = S.demographics
  if (isBlank(D.sex) && !isBlank(FeasDemo.sex || FeasDemo.gender)) { D.sex = FeasDemo.sex || FeasDemo.gender; changed = true }
  if (isBlank(D.ageMode)) {
    if (!isBlank(FeasDemo.ageMode)) { D.ageMode = FeasDemo.ageMode; changed = true }
    else if (!isBlank(FeasDemo.ageMin) || !isBlank(FeasDemo.ageMax)) { D.ageMode = 'custom'; changed = true }
    else { D.ageMode = 'any' }
  }
  if (isBlank(D.ageMin) && !isBlank(FeasDemo.ageMin)) { D.ageMin = FeasDemo.ageMin; changed = true }
  if (isBlank(D.ageMax) && !isBlank(FeasDemo.ageMax)) { D.ageMax = FeasDemo.ageMax; changed = true }
  if ((!Array.isArray(D.regions) || D.regions.length === 0) && (FeasDemo.regions || FeasDemo.region)) {
    D.regions = uniq(FeasDemo.regions || FeasDemo.region); changed = true
  }
  if (isBlank(D.sex)) D.sex = 'any'
  if (isBlank(D.ageMode)) D.ageMode = 'any'
  if (!Array.isArray(D.regions)) D.regions = []

  // Medical
  S.medical ||= {}
  const M = S.medical
  if (isBlank(M.conditions) && !isBlank(FeasMed.conditions || FeasMed.interests)) {
    M.conditions = FeasMed.conditions || FeasMed.interests; changed = true
  }
  if (isBlank(M.requiresConfirmed) && !isBlank(FeasMed.requiresConfirmed || FeasMed.confirmed)) {
    M.requiresConfirmed = (FeasMed.requiresConfirmed || FeasMed.confirmed) === 'yes' ? 'yes' : 'no'
    changed = true
  }
  if (isBlank(M.requiresConfirmed)) M.requiresConfirmed = 'no'

  // Sites (support both submit.sites.siteCodes and submit.siteCodes)
  const haveNested = S.sites && Array.isArray(S.sites.siteCodes) && S.sites.siteCodes.length
  const haveFlat = Array.isArray(S.siteCodes) && S.siteCodes.length
  if (!haveNested && !haveFlat) {
    const codes = uniq(FeasSites).map(s => s.toUpperCase())
    if (codes.length) {
      S.sites = { siteCodes: codes }
      S.siteCodes = codes
      changed = true
    }
  } else if (haveNested && !haveFlat) {
    S.siteCodes = S.sites.siteCodes.slice()
  } else if (!haveNested && haveFlat) {
    S.sites = { siteCodes: S.siteCodes.slice() }
  }

  // Always ensure studyType object exists
  S.studyType ||= { category: '' }

  if (changed) S._hydratedFromFeasibility = true
}

router.get(/^\/researcher\/(?!feasibility\/results$).*$/, (req, res, next) => {
  const data = req.session.data || (req.session.data = {})
  // Only hydrate on GET navigation; never on POST
  try { hydrate(data) } catch (e) { /* don’t crash prototype */ }
  next()
})

module.exports = router
