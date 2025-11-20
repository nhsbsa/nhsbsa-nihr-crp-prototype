// app/researcher-feasibility.js
const express = require('express')
const router = express.Router()

function ensure(req) {
  const data = req.session.data || (req.session.data = {})
  data.meta ||= {}
  data.feasibility ||= {}
  // New top-level feasibility fields
  data.feasibility.platform ??= ''                 // 'bpor' | 'jdr'
  data.feasibility.targetRecruitment ??= ''        // number (string until validated)

  // Existing models used by your views
  data.feasibility.sites ||= { list: [], defaultRadius: 10 }
  data.feasibility.diagnoses ||= { values: [] }
  data.feasibility.demographics ||= { ageMode: 'any', ageMin: '', ageMax: '', symptoms: [] }
  data.feasibility.demographicsExtended ||= { ethnicity: [], gender: [], sexAtBirth: [] }
  data.feasibility.medical ||= { include: [], exclude: [] }
  data.feasibility.disabilities ||= { include: [], exclude: [] }
  data.feasibility.other ||= {
    caresForPwD: null, carerExperience: [], livesInCareHome: null,
    hasCarer: null, mmse: ''
  }
  data.derived ||= {}
  data.status ||= {}
  // study bucket for mirroring
  data.submit ||= {}
  data.submit.study ||= {}
  data.submit.study.sites ||= { list: [] }
  return data
}

const toArr = v => Array.isArray(v) ? v : (v ? [v] : [])
const lastSaved = d => d.meta.lastSaved = new Date().toLocaleString('en-GB', { hour12: false })
const complete = (d, path) => { d.status[path] = 'completed'; lastSaved(d) }

// small guardrail so no one types 9000 miles
const clampMiles = (v, fallback) => {
  const n = parseInt(String(v ?? '').trim(), 10)
  if (!Number.isFinite(n)) return fallback
  return Math.min(200, Math.max(1, n))
}

// parse "LS1, LS2" -> ["LS1","LS2"]
function parseDistricts(input) {
  const txt = String(input || '').toUpperCase()
  if (!txt) return []
  return txt
    .split(/[,\s]+/)
    .map(s => s.trim())
    .filter(Boolean)
    .filter(s => /^[A-Z]{1,2}\d{1,2}[A-Z]?$/.test(s))
    .slice(0, 100)
}

/* -------------------------------------------------------------------
   PURE ESTIMATOR (single source of truth for all pages + API + results)
------------------------------------------------------------------- */
function estimateFromData(data) {
  const d = (data && data.feasibility) || {}
  const base = 10000
  let score = base

  // Criteria tighten the pool
  const diagCount = (d.diagnoses?.values || []).length
  score -= diagCount * 250

  const demo = d.demographics || {}
  if (demo.ageMode === '18plus') score -= 300
  if (demo.ageMode === 'custom') score -= 500
  score -= (demo.symptoms || []).length * 120

  const ext = d.demographicsExtended || {}
  score -= (ext.ethnicity || []).length * 50

  const med = d.medical || {}
  score -= (med.include || []).length * 80
  score -= (med.exclude || []).length * 120

  const dis = d.disabilities || {}
  score -= (dis.include || []).length * 50
  score -= (dis.exclude || []).length * 80

  // Geography: postcode coverage counts as defaultRadius for averaging
  const defR = d.sites?.defaultRadius || 10
  const sites = d.sites?.list || []
  const radiusVals = sites.length
    ? sites.map(s => {
        if (s.coverage && s.coverage.type === 'radius') return Number(s.coverage.miles || defR)
        if (s.coverage && s.coverage.type === 'postcode') return Number(defR)
        if (s.radius !== undefined) return Number(s.radius || defR)
        return Number(defR)
      })
    : [defR]

  const sum = radiusVals.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0)
  const avgRadius = sum / Math.max(1, radiusVals.length)

  score = Math.max(0, Math.round(score * Math.min(1, (avgRadius / 15))))

  return { available: base, matched: score }
}

/* Apply in-page overrides without touching the session (for live API) */
function applyOverrides(copy, path, values) {
  const d = copy.feasibility
  switch (path) {
    case '/researcher/feasibility/diagnoses':
      d.diagnoses.values = toArr(values.diagnoses)
      break
    case '/researcher/feasibility/demographics':
      d.demographics.ageMode = values.ageMode || d.demographics.ageMode || 'any'
      d.demographics.ageMin = values.ageMin ?? d.demographics.ageMin ?? ''
      d.demographics.ageMax = values.ageMax ?? d.demographics.ageMax ?? ''
      d.demographics.symptoms = toArr(values.symptoms)
      break
    case '/researcher/feasibility/demographics-extended':
      d.demographicsExtended.ethnicity = toArr(values.ethnicity)
      d.demographicsExtended.gender = toArr(values.gender)
      d.demographicsExtended.sexAtBirth = toArr(values.sexAtBirth)
      break
    case '/researcher/feasibility/medical':
      d.medical.include = toArr(values.include)
      d.medical.exclude = toArr(values.exclude)
      break
    case '/researcher/feasibility/disabilities':
      d.disabilities.include = toArr(values.include)
      d.disabilities.exclude = toArr(values.exclude)
      break
    case '/researcher/feasibility/other':
      d.other.caresForPwD = values.caresForPwD ?? d.other.caresForPwD
      d.other.carerExperience = toArr(values.carerExperience)
      d.other.livesInCareHome = values.livesInCareHome ?? d.other.livesInCareHome
      d.other.hasCarer = values.hasCarer ?? d.other.hasCarer
      d.other.mmse = values.mmse ?? d.other.mmse
      break
    default:
      // ignore unknown pages
      break
  }
}

// ---------------------------------------------------------------------
// STEP 1: Choose platform (BPOR / JDR)
// ---------------------------------------------------------------------
router.get('/researcher/feasibility/platform', (req, res) => {
  const data = ensure(req)
  res.render('researcher/feasibility/platform.html', {
    activeNav: 'create-request',
    model: data.feasibility,
    errors: []
  })
})

router.post('/researcher/feasibility/platform', (req, res) => {
  const data = ensure(req)
  const { platform } = req.body
  const errors = []
  if (!platform) errors.push({ href: '#platform-bpor', text: 'Select a platform to continue' })

  if (errors.length) {
    return res.render('researcher/feasibility/platform.html', {
      activeNav: 'create-request',
      model: { ...data.feasibility, platform },
      errors
    })
  }

  data.feasibility.platform = platform // 'bpor' | 'jdr'
  complete(data, '/researcher/feasibility/platform')
  return res.redirect('/researcher/feasibility/target')
})

// ---------------------------------------------------------------------
// STEP 2: Target recruitment number
// ---------------------------------------------------------------------
router.get('/researcher/feasibility/target', (req, res) => {
  const data = ensure(req)
  res.render('researcher/feasibility/target.html', {
    activeNav: 'create-request',
    model: data.feasibility,
    errors: []
  })
})

router.post('/researcher/feasibility/target', (req, res) => {
  const data = ensure(req)
  const raw = String(req.body.targetRecruitment || '').trim()
  const n = Number(raw)
  const errors = []

  if (!raw) errors.push({ href: '#targetRecruitment', text: 'Enter a target recruitment number' })
  else if (!Number.isFinite(n) || n <= 0) errors.push({ href: '#targetRecruitment', text: 'Enter a whole number greater than 0' })
  else if (!Number.isInteger(n)) errors.push({ href: '#targetRecruitment', text: 'Enter a whole number (no decimals)' })

  if (errors.length) {
    return res.render('researcher/feasibility/target.html', {
      activeNav: 'create-request',
      model: { ...data.feasibility, targetRecruitment: raw },
      errors
    })
  }

  data.feasibility.targetRecruitment = n
  complete(data, '/researcher/feasibility/target')
  return res.redirect('/researcher/feasibility/sites')
})

// ---------------------------------------------------------------------
// STEP 3: Sites (add + inline edit; radius or postcode)
// ---------------------------------------------------------------------
router.get('/researcher/feasibility/sites', (req, res) => {
  const data = ensure(req)
  res.render('researcher/feasibility/sites.html', {
    activeNav: 'create-request',
    data,
    model: data.feasibility.sites,
    errors: []
  })
})

router.post('/researcher/feasibility/sites', (req, res) => {
  const data = ensure(req)
  const sites = data.feasibility.sites

  // Explicit action flags so buttons can't trip over each other
  const {
    addSite,     // "yes" only when Add site button is clicked
    proceed,     // "yes" only when Save and continue is clicked
    removeIndex, // index to remove (string)
    siteName,
    siteCode,
    coverageType,
    radius,
    districts,
    defaultRadius,
    applyDefault // "yes" if user ticked "update existing sites"
  } = req.body || {}

  // Update default radius if posted
  if (defaultRadius !== undefined && defaultRadius !== '') {
    sites.defaultRadius = clampMiles(defaultRadius, sites.defaultRadius || 10)
  }

  // Apply default to existing radius sites
  if (applyDefault === 'yes' && Array.isArray(sites.list)) {
    const r = clampMiles(sites.defaultRadius, 10)
    sites.list = sites.list.map(s => {
      if (s.coverage?.type === 'radius' || s.radius !== undefined) {
        const base = s.coverage && s.coverage.type === 'radius' ? s.coverage : { type: 'radius', miles: r }
        return { ...s, coverage: { ...base, miles: r }, radius: undefined }
      }
      return s
    })
  }

  // 1) Remove a site
  if (removeIndex !== undefined && removeIndex !== '') {
    const idx = parseInt(removeIndex, 10)
    if (Number.isInteger(idx) && sites.list[idx]) {
      sites.list.splice(idx, 1)
      data.status['/researcher/feasibility/sites'] = sites.list.length ? 'in-progress' : 'not-started'
      lastSaved(data)
    }
    return res.redirect('/researcher/feasibility/sites')
  }

  // 2) Add a site (from the add form at the top)
  if (addSite === 'yes') {
    const name = String(siteName || '').trim()
    const code = String(siteCode || '').trim()
    const type = coverageType === 'postcode' ? 'postcode' : 'radius'

    if (name || code || radius || districts) {
      let coverage
      if (type === 'radius') {
        coverage = { type: 'radius', miles: clampMiles(radius || sites.defaultRadius || 10, sites.defaultRadius || 10) }
      } else {
        const ds = parseDistricts(districts)
        coverage = { type: 'postcode', districts: ds }
      }
      sites.list.push({ name, code, coverage })
      data.status['/researcher/feasibility/sites'] = 'in-progress'
      lastSaved(data)
    }
    return res.redirect('/researcher/feasibility/sites')
  }

  // 3) Inline edits to existing rows (posted as list[i][...])
  const posted = req.body.list
  const errors = []
  if (posted && typeof posted === 'object') {
    const idxs = Object.keys(posted)
      .map(n => parseInt(n, 10))
      .filter(Number.isInteger)
      .sort((a, z) => a - z)

    const next = idxs.map(i => {
      const r = posted[i] || {}
      const name = String(r.name || '').trim()
      const code = String(r.code || '').trim()
      const type = r.coverageType === 'postcode' ? 'postcode' : 'radius'
      if (type === 'postcode') {
        const ds = parseDistricts(r.districts)
        if (ds.length === 0) errors.push({ href: `#row-${i}-districts`, text: 'Enter at least one valid postcode district, e.g. LS1, LS2' })
        return { name, code, coverage: { type: 'postcode', districts: ds }, districtsText: String(r.districts || '').trim() }
      } else {
        const miles = clampMiles(r.radius || sites.defaultRadius || 10, sites.defaultRadius || 10)
        return { name, code, coverage: { type: 'radius', miles } }
      }
    })

    if (errors.length) {
      sites.list = next
      return res.status(400).render('researcher/feasibility/sites.html', {
        activeNav: 'create-request',
        data,
        model: sites,
        errors
      })
    }

    sites.list = next
    lastSaved(data)
  }

  // 4) Proceed to next step
  if (proceed === 'yes') {
    const sectionComplete = Array.isArray(sites.list) && sites.list.length > 0
    data.status['/researcher/feasibility/sites'] = sectionComplete ? 'completed' : 'in-progress'
    lastSaved(data)

    // Mirror feasibility -> study bucket so the study page sees them
    data.submit.study.sites = {
      list: (sites.list || []).map((s, i) => ({
        name: String(s.name || s.siteName || `Site ${i + 1}`).trim(),
        piName: '',
        piEmail: '',
        contactName: '',
        contactEmail: '',
        coverage: s.coverage // keep radius/postcode
      }))
    }

    return res.redirect('/researcher/feasibility/diagnoses')
  }

  // Fallback: nothing else to do → stay on this page
  return res.redirect('/researcher/feasibility/sites')
})

// ---------------------------------------------------------------------
// STEP 4: Diagnoses
// ---------------------------------------------------------------------
router.get('/researcher/feasibility/diagnoses', (req, res) => {
  const data = ensure(req)
  res.render('researcher/feasibility/diagnoses.html', {
    activeNav: 'create-request',
    data,
    model: data.feasibility.diagnoses,
    errors: []
  })
})

router.post('/researcher/feasibility/diagnoses', (req, res) => {
  const data = ensure(req)
  data.feasibility.diagnoses.values = toArr(req.body.diagnoses)
  complete(data, '/researcher/feasibility/diagnoses')
  res.redirect('/researcher/feasibility/demographics')
})

// ---------------------------------------------------------------------
// STEP 5: Demographics (Age & Symptoms)
// ---------------------------------------------------------------------
router.get('/researcher/feasibility/demographics', (req, res) => {
  const data = ensure(req)
  res.render('researcher/feasibility/demographics.html', {
    activeNav: 'create-request',
    data,
    model: data.feasibility.demographics,
    errors: []
  })
})

router.post('/researcher/feasibility/demographics', (req, res) => {
  const data = ensure(req)
  const m = data.feasibility.demographics
  m.ageMode = req.body.ageMode || 'any'
  m.ageMin = req.body.ageMin || ''
  m.ageMax = req.body.ageMax || ''
  m.symptoms = toArr(req.body.symptoms)
  complete(data, '/researcher/feasibility/demographics')
  res.redirect('/researcher/feasibility/demographics-extended')
})

// ---------------------------------------------------------------------
// STEP 6: Demographics (Ethnicity, Gender, Sex at birth)
// ---------------------------------------------------------------------
router.get('/researcher/feasibility/demographics-extended', (req, res) => {
  const data = ensure(req)
  res.render('researcher/feasibility/demographics-extended.html', {
    activeNav: 'create-request',
    data,
    model: data.feasibility.demographicsExtended,
    errors: []
  })
})

router.post('/researcher/feasibility/demographics-extended', (req, res) => {
  const data = ensure(req)
  const m = data.feasibility.demographicsExtended
  m.ethnicity = toArr(req.body.ethnicity)
  m.gender = toArr(req.body.gender)
  m.sexAtBirth = toArr(req.body.sexAtBirth)
  complete(data, '/researcher/feasibility/demographics-extended')
  res.redirect('/researcher/feasibility/medical')
})

// ---------------------------------------------------------------------
// STEP 7: Medical (include / exclude)
// ---------------------------------------------------------------------
router.get('/researcher/feasibility/medical', (req, res) => {
  const data = ensure(req)
  res.render('researcher/feasibility/medical.html', {
    activeNav: 'create-request',
    data,
    model: data.feasibility.medical,
    errors: []
  })
})

router.post('/researcher/feasibility/medical', (req, res) => {
  const data = ensure(req)
  data.feasibility.medical.include = toArr(req.body.include)
  data.feasibility.medical.exclude = toArr(req.body.exclude)
  complete(data, '/researcher/feasibility/medical')
  res.redirect('/researcher/feasibility/disabilities')
})

// ---------------------------------------------------------------------
// STEP 8: Disabilities (include / exclude)
// ---------------------------------------------------------------------
router.get('/researcher/feasibility/disabilities', (req, res) => {
  const data = ensure(req)
  res.render('researcher/feasibility/disabilities.html', {
    activeNav: 'create-request',
    data,
    model: data.feasibility.disabilities,
    errors: []
  })
})

router.post('/researcher/feasibility/disabilities', (req, res) => {
  const data = ensure(req)
  data.feasibility.disabilities.include = toArr(req.body.include)
  data.feasibility.disabilities.exclude = toArr(req.body.exclude)
  complete(data, '/researcher/feasibility/disabilities')
  res.redirect('/researcher/feasibility/other')
})

// ---------------------------------------------------------------------
// STEP 9: Other optional criteria
// ---------------------------------------------------------------------
router.get('/researcher/feasibility/other', (req, res) => {
  const data = ensure(req)
  res.render('researcher/feasibility/other.html', {
    activeNav: 'create-request',
    data,
    model: data.feasibility.other,
    errors: []
  })
})

router.post('/researcher/feasibility/other', (req, res) => {
  const data = ensure(req)
  const m = data.feasibility.other
  m.caresForPwD = req.body.caresForPwD || null
  m.carerExperience = toArr(req.body.carerExperience)
  m.livesInCareHome = req.body.livesInCareHome || null
  m.hasCarer = req.body.hasCarer || null
  m.mmse = req.body.mmse || ''
  complete(data, '/researcher/feasibility/other')
  res.redirect('/researcher/feasibility/results')
})

// ---------------------------------------------------------------------
// STEP 10: Results (compute via central estimator + mark complete)
// ---------------------------------------------------------------------
router.get('/researcher/feasibility/results', (req, res) => {
  const data = ensure(req)
  const result = estimateFromData(data)

  data.feasibility.totalEstimate = result.available
  data.derived.matchedEstimate = result.matched
  data.feasibility.completed = true
  lastSaved(data)

  res.render('researcher/feasibility/results.html', {
    activeNav: 'create-request',
    data
  })
})

/* ---------------------------------------------------------------------
   LIVE ESTIMATE API (READ-ONLY): POST /researcher/feasibility/estimate
   Body: { overrides: { path: '/researcher/feasibility/medical', values: {...} } }
--------------------------------------------------------------------- */
router.post('/researcher/feasibility/estimate', express.json(), (req, res) => {
  const data = ensure(req)
  const { overrides } = req.body || {}
  const copy = JSON.parse(JSON.stringify(data))
  if (overrides && overrides.path) {
    applyOverrides(copy, String(overrides.path), overrides.values || {})
  }
  const out = estimateFromData(copy)
  res.json(out)
})

module.exports = router
