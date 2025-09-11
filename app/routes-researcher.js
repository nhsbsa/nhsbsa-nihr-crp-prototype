// app/routes-researcher.js
// Researcher submission flow – improved

const express = require('express')
const router = express.Router()

/* ---------------- Helpers ---------------- */
function isEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||'').trim()) }
function toInt(v) { const n = parseInt(v, 10); return Number.isFinite(n) ? n : null }
function isoValid(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s||''))) return false
  const d = new Date(s + 'T00:00:00Z')
  const ok = !isNaN(d.getTime())
  if (!ok) return false
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return s === `${d.getUTCFullYear()}-${mm}-${dd}`
}
function nowGB() {
  return new Date().toLocaleString('en-GB', { hour12: false })
}
function saveStamp(req) { if (req.session) req.session._lastSaved = nowGB() }

// simple CPMS stub
function fetchFromCPMS(id) {
  const clean = String(id || '').trim().toUpperCase()
  if (!/^CPMS?\d{5,7}$/.test(clean)) return null
  return {
    cpmsId: clean,
    title: 'Feasibility study of community follow-up for post-surgical patients',
    sponsor: 'University of Birmingham',
    dates: { start: '12 March 2025', end: '30 September 2026' }
  }
}

// pretend known users (so we can show Invite pending vs Active)
const EXISTING_USER_EMAILS = [
  'pi@exampletrust.nhs.uk','contact@nihr.ac.uk','site.admin@manchester.nhs.uk'
]

// feasibility model
function estimateVolunteers({ ageMin, ageMax, geoMethod, inclusion = [], jdrHealth = null }) {
  const min = Number.isFinite(Number(ageMin)) ? Number(ageMin) : null
  const max = Number.isFinite(Number(ageMax)) ? Number(ageMax) : null
  const base = 45000
  const span = (min !== null && max !== null && max >= min) ? (max - min) : 80
  const ageFactor = Math.min(1, Math.max(0.1, span / 80))
  let geoFactor = 1
  if (geoMethod === 'distance') geoFactor = 0.6
  else if (geoMethod === 'region') geoFactor = 0.4
  else if (geoMethod === 'postcode') geoFactor = 0.3
  let incFactor = 1
  const set = new Set(Array.isArray(inclusion) ? inclusion : [inclusion].filter(Boolean))
  if (set.has('UK resident')) incFactor *= 0.9
  if (set.has('Has relevant condition')) incFactor *= 0.5
  if (set.has('Carer / family member')) incFactor *= 0.8
  let jdrFactor = 1
  if (jdrHealth === 'yes') jdrFactor = 0.7
  else if (jdrHealth === 'no') jdrFactor = 0.9
  let est = base * ageFactor * geoFactor * incFactor * jdrFactor
  est = Math.max(0, Math.round(est / 50) * 50)
  return est
}

/* ---------------- Task list ---------------- */
router.get('/researcher/task-list', (req, res) => {
  const st = {
    identify: !!(req.session.studyIdentify || req.session.cpmsResult || req.session.studyMeta),
    details:  !!req.session.studyDetails,
    scope:    !!req.session.studyScope,
    criteria: !!req.session.volCriteria,
    arms:     !!req.session.studyArms,
    sites:    !!req.session.studySites,
    ethics:   !!req.session.ethics
  }

  const order = [
    { key: 'identify', label: 'Identify your study', href: '/researcher/identify' },
    { key: 'details',  label: 'Study details',       href: '/researcher/study-details' },
    { key: 'scope',    label: 'Choose platform(s)',  href: '/researcher/scope' },
    { key: 'criteria', label: 'Volunteer criteria',  href: '/researcher/volunteer-criteria' },
    { key: 'arms',     label: 'Arms / sub-studies',  href: '/researcher/arms' },
    { key: 'sites',    label: 'Sites & contacts',    href: '/researcher/sites' },
    { key: 'ethics',   label: 'Ethics approval',     href: '/researcher/ethics' }
  ]
  const totalCount = order.length
  const completedCount = order.reduce((n, s) => n + (st[s.key] ? 1 : 0), 0)
  const progressPct = Math.round((completedCount / totalCount) * 100)
  const next = order.find(s => !st[s.key]) || null

  const rawEst = req.session?.volCriteria?._estCount
  const estCount = (typeof rawEst === 'number' && isFinite(rawEst)) ? rawEst : null
  const sitesArr = Array.isArray(req.session?.studySites?.sites) ? req.session.studySites.sites : []
  const invitePendingCount = sitesArr.filter(s => s && s.needsInvite === true).length
  const pageHint = 'Complete each section, then preview and submit your study.'
  const lastSaved = req.session?._lastSaved || null
  const canPreview = st.identify && st.details && st.scope && st.criteria

  res.render('researcher/task-list', {
    st,
    totalCount, completedCount, progressPct,
    nextHref: next ? next.href : null,
    nextLabel: next ? next.label : null,
    canPreview,
    estCount,
    invitePendingCount,
    pageHint,
    lastSaved
  })
})

router.post('/researcher/task-list/reset', (req, res) => {
  req.session.studyIdentify = null
  req.session.cpmsResult = null
  req.session.studyMeta = null
  req.session.studyDetails = null
  req.session.studyScope = null
  req.session.volCriteria = null
  req.session.studyArms = null
  req.session.studySites = null
  req.session.ethics = null
  req.session.submissions = []
  req.session._lastSaved = null
  res.redirect('/researcher/task-list')
})

/* ---------------- Identify your study ---------------- */
router.get('/researcher/identify', (req, res) => {
  const data = req.session?.studyIdentify || {}
  res.render('researcher/identify-study', { data, errors: {} })
})

router.post('/researcher/identify', (req, res) => {
  const { hasCpms, cpmsId = '', title = '', sponsor = '' } = req.body || {}
  const errors = {}
  const data = { hasCpms, cpmsId, title, sponsor }

  if (!hasCpms) {
    errors.hasCpms = 'Select if you have a CPMS ID'
  } else if (hasCpms === 'yes') {
    const ok = /^CPMS?\d{5,7}$/i.test((cpmsId || '').trim())
    if (!ok) errors.cpmsId = 'Enter a CPMS ID in the correct format, for example CPMS123456'
  } else if (hasCpms === 'no') {
    if (!title.trim()) errors.title = 'Enter the study title'
    if (!sponsor.trim()) errors.sponsor = 'Enter the study sponsor'
  }

  if (Object.keys(errors).length) {
    return res.status(400).render('researcher/identify-study', { errors, data })
  }

  req.session.studyIdentify = data
  saveStamp(req)

  if (hasCpms === 'yes') {
    const result = fetchFromCPMS(cpmsId)
    if (!result) {
      return res.status(404).render('researcher/identify-study', {
        data,
        errors: { cpmsId: 'We could not find a study with that CPMS ID. Check the ID and try again.' }
      })
    }
    req.session.cpmsResult = result
    return res.redirect('/researcher/cpms-confirm')
  }
  return res.redirect('/researcher/study-details')
})

router.get('/researcher/cpms-confirm', (req, res) => {
  const result = req.session?.cpmsResult
  if (!result) return res.redirect('/researcher/identify')
  res.render('researcher/cpms-confirm', { result })
})

router.post('/researcher/cpms-confirm', (req, res) => {
  const result = req.session?.cpmsResult
  if (result) {
    req.session.studyMeta = { title: result.title, sponsor: result.sponsor, cpmsId: result.cpmsId }
  }
  saveStamp(req)
  return res.redirect('/researcher/task-list')
})

/* ---------------- Study details ---------------- */
router.get('/researcher/study-details', (req, res) => {
  const data = req.session?.studyDetails || {}
  const meta = req.session?.studyMeta || req.session?.cpmsResult || req.session?.studyIdentify || {}
  res.render('researcher/study-details', { data, meta, errors: {} })
})

router.post('/researcher/study-details', (req, res) => {
  const {
    shortName = '',
    laySummary = '',
    recruitmentStartDate = '',
    recruitmentEndDate = '',
    // legacy fallbacks
    startDay = '', startMonth = '', startYear = '',
    endDay = '', endMonth = '', endYear = '',
    conditions = ''
  } = req.body || {}

  const errors = {}

  if (!shortName.trim()) errors.shortName = 'Enter a short name for this study'
  if (!laySummary.trim()) errors.laySummary = 'Enter a lay summary'

  // resolve start/end ISO
  let startISO = '', endISO = ''
  if (recruitmentStartDate && isoValid(recruitmentStartDate)) startISO = recruitmentStartDate
  if (recruitmentEndDate && isoValid(recruitmentEndDate)) endISO = recruitmentEndDate

  const d = toInt(startDay), m = toInt(startMonth), y = toInt(startYear)
  const ed = toInt(endDay), em = toInt(endMonth), ey = toInt(endYear)
  function fromParts(dd, mm, yy) {
    if (dd && mm && yy) {
      const s = `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
      return isoValid(s) ? s : ''
    }
    return ''
    }
  if (!startISO) startISO = fromParts(d, m, y)
  if (!endISO)   endISO   = fromParts(ed, em, ey)

  if (!startISO) errors.startDate = 'Enter a valid recruitment start date'
  if (!endISO)   errors.endDate   = 'Enter a valid recruitment end date'
  if (!errors.startDate && !errors.endDate) {
    if (new Date(endISO) < new Date(startISO)) {
      errors.endDate = 'End date must be the same as or after the start date'
    }
    const todayISO = new Date().toISOString().slice(0,10)
    if (startISO < todayISO) {
      // soft warning: we allow, but present as page hint later (no error)
    }
  }

  const data = {
    shortName, laySummary,
    recruitmentStartDate, recruitmentEndDate,
    startDay, startMonth, startYear, endDay, endMonth, endYear,
    conditions
  }

  if (Object.keys(errors).length) {
    const meta = req.session?.studyMeta || req.session?.cpmsResult || req.session?.studyIdentify || {}
    return res.status(400).render('researcher/study-details', { errors, data, meta })
  }

  req.session.studyDetails = {
    shortName: shortName.trim(),
    laySummary: laySummary.trim(),
    recruitmentStartISO: startISO,
    recruitmentEndISO: endISO,
    conditions: String(conditions||'').split(',').map(s=>s.trim()).filter(Boolean)
  }
  saveStamp(req)
  return res.redirect('/researcher/task-list')
})

/* ---------------- Scope ---------------- */
router.get('/researcher/scope', (req, res) => {
  const data = req.session?.studyScope || {}
  res.render('researcher/select-scope', { data, errors: {} })
})

router.post('/researcher/scope', (req, res) => {
  let scope = req.body?.scope || []
  if (!Array.isArray(scope)) scope = [scope]
  if (!scope.length) {
    return res.status(400).render('researcher/select-scope', {
      errors: { scope: 'Select at least one scope' },
      data: { scope }
    })
  }
  req.session.studyScope = { scope }
  saveStamp(req)
  return res.redirect('/researcher/task-list')
})

/* ---------------- Volunteer criteria ---------------- */
router.get('/researcher/volunteer-criteria', (req, res) => {
  const saved = req.session?.volCriteria || {}
  const scope = req.session?.studyScope?.scope || []
  const _estCount = estimateVolunteers({
    ageMin: saved.ageMin, ageMax: saved.ageMax,
    geoMethod: saved.geoMethod,
    inclusion: saved.inclusion,
    jdrHealth: saved.jdrHealth
  })
  const data = { ...saved, _estCount }
  res.render('researcher/volunteer-criteria', { data, scope, errors: {} })
})

router.post('/researcher/volunteer-criteria', (req, res) => {
  const scope = req.session?.studyScope?.scope || []
  const { ageMin='', ageMax='', geoMethod='', inclusion=[], jdrHealth='' } = req.body || {}

  const errors = {}
  const min = parseInt(ageMin, 10); const max = parseInt(ageMax, 10)
  if (!Number.isFinite(min) || min < 0) errors.ageMin = 'Enter a valid minimum age'
  if (!Number.isFinite(max) || max < 0) errors.ageMax = 'Enter a valid maximum age'
  if (!errors.ageMin && !errors.ageMax && min > max) errors.ageMax = 'Maximum age must be the same as or greater than minimum age'
  if (!geoMethod) errors.geoMethod = 'Select a geography method'
  if (scope.includes('JDR') && !jdrHealth) errors.jdrHealth = 'Select yes if your study includes health-related criteria'

  let incl = inclusion
  if (!Array.isArray(incl)) incl = [incl].filter(Boolean)
  const data = { ageMin, ageMax, geoMethod, inclusion: incl, jdrHealth }

  if (Object.keys(errors).length) {
    data._estCount = estimateVolunteers({ ageMin, ageMax, geoMethod, inclusion: incl, jdrHealth })
    return res.status(400).render('researcher/volunteer-criteria', { errors, data, scope })
  }

  const _estCount = estimateVolunteers({ ageMin: min, ageMax: max, geoMethod, inclusion: incl, jdrHealth })
  req.session.volCriteria = {
    ageMin: min, ageMax: max, geoMethod, inclusion: incl,
    jdrHealth: scope.includes('JDR') ? jdrHealth : null,
    _estCount
  }
  saveStamp(req)
  return res.redirect('/researcher/task-list')
})

/* ---------------- Arms ---------------- */
router.get('/researcher/arms', (req, res) => {
  const data = req.session?.studyArms || { hasMultiple: '', arms: [{ name: 'Arm A', desc: '' }] }
  res.render('researcher/arms', { data, errors: {} })
})

router.post('/researcher/arms', (req, res) => {
  const { hasMultiple='', action='', armName=[], armDesc=[] } = req.body || {}
  const names = Array.isArray(armName) ? armName : [armName]
  const descs = Array.isArray(armDesc) ? armDesc : [armDesc]
  let arms = names.map((n,i)=>({ name: String(n||'').trim(), desc: String(descs[i]||'').trim() }))

  if (action === 'add') {
    arms.push({ name: `Arm ${String.fromCharCode(65 + arms.length)}`, desc: '' })
    return res.render('researcher/arms', { data: { hasMultiple, arms }, errors: {} })
  }

  const errors = {}
  if (!hasMultiple) errors.hasMultiple = 'Select yes if your study has more than one arm'
  if (hasMultiple === 'yes') {
    if (arms.length < 2) errors.arms = 'Add at least 2 arms'
    if (arms.some(a => !a.name)) errors.arms = 'Enter a name for each arm'
  } else {
    arms = [{ name: 'Single arm', desc: '' }]
  }

  if (Object.keys(errors).length) {
    return res.status(400).render('researcher/arms', { errors, data: { hasMultiple, arms } })
  }

  req.session.studyArms = { hasMultiple, arms }
  saveStamp(req)
  return res.redirect('/researcher/task-list')
})

/* ---------------- Sites & contacts (with Invite pending) ---------------- */
router.get('/researcher/sites', (req, res) => {
  const data = req.session?.studySites || { sites: [{ site: '', ods: '', email: '' }] }
  res.render('researcher/sites', { data, errors: {} })
})

router.post('/researcher/sites', (req, res) => {
  const { action='', siteName=[], siteOds=[], siteEmail=[], index='' } = req.body || {}

  // Normalise arrays
  const names = Array.isArray(siteName) ? siteName : [siteName]
  const odss  = Array.isArray(siteOds)  ? siteOds  : [siteOds]
  const emails= Array.isArray(siteEmail)? siteEmail: [siteEmail]

  // Load current
  let sites = (req.session?.studySites?.sites || []).slice()
  if (!sites.length) sites = [{ site:'', ods:'', email:'' }]

  // Build from form unless "resend"
  if (action !== 'resend') {
    sites = names.map((n,i)=>({
      site: String(n||'').trim(),
      ods:  String(odss[i]||'').trim(),
      email:String(emails[i]||'').trim(),
      needsInvite: undefined, inviteSentAt: undefined, resendCount: undefined
    }))
  }

  if (action === 'add') {
    sites.push({ site: '', ods: '', email: '' })
    return res.render('researcher/sites', { data: { sites }, errors: {} })
  }

  if (action === 'resend') {
    const ix = toInt(index)
    if (ix !== null && sites[ix]) {
      if (sites[ix].needsInvite) {
        sites[ix].inviteSentAt = nowGB()
        sites[ix].resendCount = (sites[ix].resendCount || 0) + 1
      }
    }
    req.session.studySites = { sites }
    saveStamp(req)
    return res.redirect('/researcher/sites')
  }

  // Validate & set invite flags
  const errors = {}
  if (sites.length === 0) errors.sites = 'Add at least one study site'
  sites.forEach((s, idx) => {
    if (!s.site && !s.ods) errors[`site_${idx}`] = 'Enter an NHS site name or ODS code'
    if (!isEmail(s.email)) errors[`email_${idx}`] = 'Enter a valid email address'
  })

  if (Object.keys(errors).length) {
    return res.status(400).render('researcher/sites', { errors, data: { sites } })
  }

  sites = sites.map(s => {
    const needsInvite = !EXISTING_USER_EMAILS.includes(s.email.toLowerCase())
    let inviteSentAt = s.inviteSentAt
    if (needsInvite && !inviteSentAt) inviteSentAt = nowGB()
    return { ...s, needsInvite, inviteSentAt, resendCount: s.resendCount || (needsInvite ? 0 : 0) }
  })

  req.session.studySites = { sites }
  saveStamp(req)
  return res.redirect('/researcher/task-list')
})

/* ---------------- Ethics ---------------- */
router.get('/researcher/ethics', (req, res) => {
  const saved = req.session.ethics || {}
  res.render('researcher/ethics', {
    data: { hasEthics: saved.hasEthics || '', approvalFile: saved.approvalFile || '' },
    errors: {}
  })
})

router.post('/researcher/ethics', (req, res) => {
  const hasEthics = (req.body.hasEthics || '').trim()
  const approvalFile = (req.body.approvalFileName || '').trim()
  const errors = {}
  if (!hasEthics) errors.hasEthics = 'Select yes or no'
  else if (hasEthics === 'yes' && !approvalFile) errors.approvalFile = 'Upload your approval letter'

  if (Object.keys(errors).length) {
    return res.status(400).render('researcher/ethics', {
      data: { hasEthics, approvalFile }, errors
    })
  }

  req.session.ethics = { hasEthics, approvalFile: hasEthics === 'yes' ? approvalFile : '' }
  saveStamp(req)
  return res.redirect('/researcher/task-list')
})

/* ---------------- Preview ---------------- */
router.get('/researcher/preview', (req, res) => {
  const scope   = req.session?.studyScope?.scope || []
  const meta    = req.session?.studyMeta || req.session?.cpmsResult || req.session?.studyIdentify || {}
  const details = req.session?.studyDetails || {}
  const criteria= req.session?.volCriteria || {}
  const sites   = req.session?.studySites?.sites || []
  res.render('researcher/preview', { scope, meta, details, criteria, sites })
})

router.post('/researcher/preview', (req, res) => res.redirect('/researcher/check-answers'))

/* ---------------- Check answers & submit ---------------- */
function toISOFromParts(obj, prefix) {
  const isoKey = prefix + 'ISO'
  if (obj && obj[isoKey]) return String(obj[isoKey])
  const d = obj?.[prefix + 'Day'] ?? obj?.[prefix]?.day
  const m = obj?.[prefix + 'Month'] ?? obj?.[prefix]?.month
  const y = obj?.[prefix + 'Year'] ?? obj?.[prefix]?.year
  const day = parseInt(d, 10), month = parseInt(m, 10), year = parseInt(y, 10)
  if (Number.isFinite(day) && Number.isFinite(month) && Number.isFinite(year)) {
    const dd = String(day).padStart(2, '0'), mm = String(month).padStart(2, '0')
    const iso = `${year}-${mm}-${dd}`; return isoValid(iso) ? iso : ''
  }
  return ''
}

router.get('/researcher/check-answers', (req, res) => {
  const meta     = req.session.studyMeta || req.session.cpmsResult || {}
  const details0 = req.session.studyDetails || req.session.details || {}
  const scope    = (req.session.studyScope && req.session.studyScope.scope) || []
  const criteria = req.session.volCriteria || {}
  const arms     = req.session.studyArms || {}
  const sites    = (req.session.studySites && req.session.studySites.sites) || []
  const ethics   = req.session.ethics || {}

  const details = {
    shortName: (details0.shortName || '').trim(),
    laySummary: (details0.laySummary || '').trim(),
    recruitmentStartISO: toISOFromParts(details0, 'recruitmentStart'),
    recruitmentEndISO: toISOFromParts(details0, 'recruitmentEnd'),
    conditions: Array.isArray(details0.conditions) ? details0.conditions.filter(Boolean) : []
  }

  // Readiness checklist
  const readiness = {
    platformsSelected: Array.isArray(scope) && scope.length > 0,
    ethicsProvided: ethics.hasEthics === 'yes',
    sitesAdded: sites.length > 0,
    activeContactPresent: sites.some(s => s && s.needsInvite === false)
  }

  res.render('researcher/check-answers', {
    meta, details, scope, criteria, arms, sites, ethics, readiness
  })
})

router.post('/researcher/check-answers', (req, res) => {
  if (!req.session.submissions) req.session.submissions = []

  const meta     = req.session.studyMeta || req.session.cpmsResult || {}
  const details0 = req.session.studyDetails || req.session.details || {}
  const scope    = (req.session.studyScope && req.session.studyScope.scope) || []
  const criteria = req.session.volCriteria || {}
  const arms     = req.session.studyArms || {}
  const sites    = (req.session.studySites && req.session.studySites.sites) || []
  const ethics   = req.session.ethics || {}

  const details = {
    shortName: (details0.shortName || '').trim(),
    laySummary: (details0.laySummary || '').trim(),
    recruitmentStartISO: toISOFromParts(details0, 'recruitmentStart'),
    recruitmentEndISO: toISOFromParts(details0, 'recruitmentEnd'),
    conditions: Array.isArray(details0.conditions) ? details0.conditions.filter(Boolean) : []
  }

  req.session.submissions.unshift({
    id: 'SUB' + Math.floor(100000 + Math.random() * 900000),
    submittedAt: new Date().toISOString(),
    meta, details, scope, criteria, arms, sites, ethics
  })

  return res.redirect('/researcher/confirmation')
})

router.get('/researcher/confirmation', (req, res) => res.render('researcher/confirmation'))

module.exports = router
