// app/routes-admin.js
// Admin + Researcher routes
// UPDATE: Wire existing researcher task-list pages (identify-study, study-details,
// select-scope, arms, sites, ethics, preview, check-answers) and drive status from session.
// Feasibility -> "Continue to submit new study" now flows to /researcher/start-study
// and passes the estimated count into the study criteria for preview/check-answers.

const express = require('express')
const router = express.Router()

/* ---------------- helpers ---------------- */
function nowGB () { return new Date().toLocaleString('en-GB', { hour12: false }) }
function requireAdmin (req, res, next) { if (!req.session || !req.session.user) return res.redirect('/admin/sign-in'); next() }
function requireResearcher (req, res, next) { if (!req.session || !req.session.researcher) return res.redirect('/researcher/sign-in'); next() }
function nameFromEmail (email) {
  const local = String(email || '').split('@')[0]
  const parts = local.split(/[._-]/).filter(Boolean)
  const cap = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '')
  const name = parts.map(cap).join(' ')
  return name || 'User'
}

/* Shared locals */
router.use((req, res, next) => {
  res.locals.serviceName = process.env.SERVICE_NAME || 'Research platform'
  res.locals.isAdminSignedIn = !!(req.session && req.session.user)
  res.locals.isResearcherSignedIn = !!(req.session && req.session.researcher)
  res.locals.currentUserName =
    (req.session && req.session.user && req.session.user.name) ||
    (req.session && req.session.researcher && req.session.researcher.name) ||
    ''
  next()
})

/* ---------------- admin seeds for demo ---------------- */
function ensureRequestsSeed (req) {
  if (!Array.isArray(req.session.accountRequests) || req.session.accountRequests.length === 0) {
    req.session.accountRequests = [
      { id: 'REQ001', name: 'John Smith',       org: 'University of Birmingham',        submitted: '6 August 2025', type: 'Researcher',           email: 'john.smith@bham.ac.uk' },
      { id: 'REQ002', name: 'Claire Robinson',  org: 'Alzheimer’s Research UK',         submitted: '6 August 2025', type: 'Researcher',           email: 'claire@alzres.org'     },
      { id: 'REQ003', name: 'Dr Michael Patel', org: 'Manchester University NHS Trust', submitted: '6 August 2025', type: 'Researcher',           email: 'm.patel@mft.nhs.uk'    },
      { id: 'REQ004', name: 'Jane Doe',         org: 'NIHR RDN',                        submitted: '6 August 2025', type: 'System administrator', email: 'jane.doe@nihr.ac.uk'    }
    ]
  }
}
function ensureUsersSeed (req) {
  if (!Array.isArray(req.session.users) || req.session.users.length === 0) {
    req.session.users = [
      { id: 'U1001', title: 'Mr',  firstName: 'John',    lastName: 'Smith',    email: 'john.smith@bham.ac.uk', org: 'University of Birmingham',         role: 'Researcher' },
      { id: 'U1002', title: 'Ms',  firstName: 'Claire',  lastName: 'Robinson', email: 'claire@alzres.org',     org: 'Alzheimer’s Research UK',         role: 'Researcher' },
      { id: 'U1003', title: 'Dr',  firstName: 'Michael', lastName: 'Patel',    email: 'm.patel@mft.nhs.uk',    org: 'Manchester University NHS Trust', role: 'Researcher' },
      { id: 'U1004', title: 'Mrs', firstName: 'Jane',    lastName: 'Doe',      email: 'jane.doe@nihr.ac.uk',   org: 'NIHR RDN',                        role: 'System administrator' }
    ]
  }
}
function ensureSeedStudies (req) {
  if (!Array.isArray(req.session.submissions) || req.session.submissions.length === 0) {
    req.session.submissions = [
      {
        id: 'SUB123456',
        submittedAt: new Date(Date.now() - 864e5).toISOString(),
        meta: { title: 'Community physio follow-up after day-surgery', sponsor: 'UoB' },
        details: { shortName: 'COMM-FUP', laySummary: 'We will check whether short home physio can help recovery.', recruitmentStartISO: '2025-10-01', recruitmentEndISO: '2026-03-31', conditions: ['physiotherapy', 'day surgery'] },
        scope: ['JDR', 'BPOR'],
        criteria: { ageMin: 18, ageMax: 80, geoMethod: 'distance', inclusion: ['UK resident'], _estCount: 2150 },
        arms: { hasMultiple: 'no', arms: [{ name: 'Single arm', desc: '' }] },
        sites: { sites: [{ site: 'Manchester Royal Infirmary', ods: 'R0A', email: 'site.admin@manchester.nhs.uk', needsInvite: false }] },
        ethics: { hasEthics: 'yes', approvalFile: 'REC-approval-123.pdf' },
        admin: { status: 'submitted', owner: null, timeline: [{ at: nowGB(), by: 'System', action: 'Submitted', note: '' }], notes: [] }
      }
    ]
  }
}

/* =========================================================================
   AUTH – Admin (unchanged basics)
   ========================================================================= */
router.get('/admin/sign-in', (req, res) => {
  const next = req.query.next || '/admin'
  res.render('admin/sign-in', { next })
})
router.post('/admin/sign-in', (req, res) => {
  const next = req.body.next || '/admin'
  res.redirect('/admin/google/start?next=' + encodeURIComponent(next))
})
router.get('/admin/google/start', (req, res) => {
  const next = req.query.next || '/admin'
  res.render('admin/google-signin', { errors: {}, email: '', next })
})
router.post('/admin/google/verify', (req, res) => {
  const email = String(req.body.email || '').trim()
  const next = req.body.next || '/admin'
  const errors = {}
  if (!email) errors.email = 'Enter your NIHR Google email address'
  else if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) errors.email = 'Enter a valid NIHR Google email address'
  if (Object.keys(errors).length) return res.render('admin/google-signin', { errors, email, next })
  const name = nameFromEmail(email); const parts = name.split(' ')
  req.session.user = { name, email, signedInAt: nowGB(), title: 'Mrs', firstName: parts[0] || name, lastName: parts.slice(1).join(' ') || '', org: 'NIHR RDN', role: 'System administrator' }
  res.redirect(next)
})
router.get('/admin/logout', (req, res) => {
  req.session.user = null
  if (req.session && typeof req.session.destroy === 'function') return req.session.destroy(() => res.redirect('/admin/sign-in'))
  res.redirect('/admin/sign-in')
})

/* =========================================================================
   ADMIN: Dashboard + basic sections (left as you already had)
   ========================================================================= */
router.get('/admin', requireAdmin, (req, res) => {
  ensureRequestsSeed(req); ensureSeedStudies(req)
  const accountRequestsNew = (req.session.accountRequests || []).length
  const preScreenerNew = (req.session.submissions || []).filter(s => (s.admin?.status || 'submitted') === 'submitted').length
  res.render('admin/dashboard', {
    user: req.session.user,
    activeNav: 'dashboard',
    accountRequestsNew,
    preScreenerNew,
    adminAccountNew: 0,
    pageH1: `${req.session.user.name} dashboard`
  })
})

/* =========================================================================
   AUTH – Researcher (unchanged basics)
   ========================================================================= */
router.get(['/researcher/start', '/start'], (req, res) => res.render('researcher/start'))
router.get('/reseacher/start', (req, res) => res.redirect('/researcher/start'))
router.get(['/researcher/sign-in', '/sign-in'], (req, res) => { res.render('researcher/sign-in', { errors: {}, values: { email: '' } }) })
router.get('/reseacher/sign-in', (req, res) => res.redirect('/researcher/sign-in'))
router.post(['/researcher/sign-in', '/sign-in'], (req, res) => {
  const email = String(req.body.email || '').trim()
  const password = String(req.body.password || '').trim()
  const errors = {}
  if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) errors.email = 'format'
  if (!password || password.length < 8) errors.password = 'incorrect'
  if (Object.keys(errors).length) return res.status(400).render('researcher/sign-in', { errors, values: { email } })
  const fullName = nameFromEmail(email); const parts = fullName.split(' ')
  req.session.researcher = { id: 'R' + Math.floor(Math.random() * 9000 + 1000), title: 'Mrs', firstName: parts[0] || 'Jane', lastName: parts.slice(1).join(' ') || 'Doe', name: fullName, email, org: 'NIHR RDN', role: 'Researcher', activeStudies: [] }
  const nextUrl = req.session.researcherNext || '/researcher'
  req.session.researcherNext = null
  return res.redirect(nextUrl)
})
router.get(['/researcher/logout', '/logout'], (req, res) => { req.session.researcher = null; res.redirect('/researcher/sign-in') })
router.get('/researcher', requireResearcher, (req, res) => { res.render('researcher/dashboard', { me: req.session.researcher, activeNav: 'study-mgmt' }) })

/* =========================================================================
   RESEARCHER: Feasibility
   ========================================================================= */
router.get('/researcher/feasibility', requireResearcher, (req, res) => {
  const defaults = { target: 100, ageMin: 18, ageMax: 80, sex: 'any', conditions: '', confirmed: false, sitesCSV: '', radius: '25' }
  res.render('researcher/feasibility', {
    me: req.session.researcher,
    activeNav: 'study-mgmt',
    errors: {},
    values: Object.assign({}, defaults, req.session.lastFeasibilityValues || {}),
    result: req.session.lastFeasibilityResult || null
  })
})
router.post('/researcher/feasibility', requireResearcher, (req, res) => {
  const values = {
    target: parseInt(req.body.target || '0', 10) || 0,
    ageMin: parseInt(req.body.ageMin || '0', 10) || 0,
    ageMax: parseInt(req.body.ageMax || '0', 10) || 0,
    sex: (req.body.sex || 'any'),
    conditions: String(req.body.conditions || '').trim(),
    confirmed: req.body.confirmed === 'yes',
    sitesCSV: String(req.body.sitesCSV || '').trim(),
    radius: String(req.body.radius || '25')
  }
  const errors = {}
  if (!values.target || values.target < 1) errors.target = 'Enter a recruitment target'
  if (values.ageMin < 0 || values.ageMax < values.ageMin) errors.age = 'Enter a valid age range'
  if (!['any', 'male', 'female'].includes(values.sex)) values.sex = 'any'
  if (!['5', '10', '25', '50', '100'].includes(values.radius)) values.radius = '25'
  if (Object.keys(errors).length) {
    return res.status(400).render('researcher/feasibility', { me: req.session.researcher, activeNav: 'study-mgmt', errors, values, result: null })
  }
  const estimated = Math.max(values.target - Math.floor(Math.random() * (values.target / 2)), Math.floor(Math.random() * (values.target * 2)))
  const result = { estimated, target: values.target, enough: estimated >= values.target }
  req.session.lastFeasibilityValues = values
  req.session.lastFeasibilityResult = result

  // Seed the study session so previews can show the estimate later.
  ensureStudySession(req)
  req.session.study.criteria = req.session.study.criteria || {}
  req.session.study.criteria._estCount = estimated

  return res.render('researcher/feasibility', { me: req.session.researcher, activeNav: 'study-mgmt', errors: {}, values, result })
})

/* =========================================================================
   RESEARCHER: Submit a study (existing pages wired)
   ========================================================================= */
function ensureStudySession (req) {
  if (!req.session.study) {
    req.session.study = {
      meta: {},
      details: {},
      scope: [],
      criteria: {},     // kept minimal – your UI for criteria is separate
      arms: { hasMultiple: 'no', arms: [] },
      sites: { sites: [] },
      ethics: {}
    }
  }
  if (!req.session.studyTask) {
    req.session.studyTask = { identify:false, details:false, scope:false, arms:false, sites:false, ethics:false }
  }
  return req.session.study
}
function taskProgress (req) {
  const st = req.session.studyTask || {}
  const totalCount = 6
  const completedCount = Object.values(st).filter(Boolean).length
  return { st, totalCount, completedCount, progressPct: Math.round(completedCount / totalCount * 100) }
}

router.get('/researcher/start-study', requireResearcher, (req, res) => {
  ensureStudySession(req)
  res.render('researcher/start-study') // your existing page
})

router.get('/researcher/task-list', requireResearcher, (req, res) => {
  ensureStudySession(req)
  const prog = taskProgress(req)
  const lastSaved = req.session.studyTaskSavedAt || null
  const estCount = (req.session.study && req.session.study.criteria && req.session.study.criteria._estCount) || null
  res.render('researcher/task-list', {
    st: prog.st,
    totalCount: prog.totalCount,
    completedCount: prog.completedCount,
    progressPct: prog.progressPct,
    pageHint: null,
    estCount,
    invitePendingCount: null,
    lastSaved,
    nextHref: nextStepHref(prog.st),
    nextLabel: nextStepLabel(prog.st),
    canPreview: (prog.st.identify && prog.st.details && prog.st.scope)
  })
})
router.post('/researcher/task-list/reset', requireResearcher, (req, res) => {
  req.session.study = null
  req.session.studyTask = null
  req.session.studyTaskSavedAt = nowGB()
  res.redirect('/researcher/task-list')
})

function nextStepHref (st) {
  if (!st.identify) return '/researcher/identify'
  if (!st.details)  return '/researcher/study-details'
  if (!st.scope)    return '/researcher/scope'
  if (!st.arms)     return '/researcher/arms'
  if (!st.sites)    return '/researcher/sites'
  if (!st.ethics)   return '/researcher/ethics'
  return '/researcher/preview'
}
function nextStepLabel (st) {
  if (!st.identify) return 'Identify your study'
  if (!st.details)  return 'Study details'
  if (!st.scope)    return 'Choose platform(s)'
  if (!st.arms)     return 'Arms / sub-studies'
  if (!st.sites)    return 'Sites & contacts'
  if (!st.ethics)   return 'Ethics approval'
  return 'Preview your study'
}

/* ---- Step: Identify your study (identify-study.html) ---- */
router.get('/researcher/identify', requireResearcher, (req, res) => {
  ensureStudySession(req)
  const data = req.session.study.meta || {}
  res.render('researcher/identify-study', { errors: {}, data })
})
router.post('/researcher/identify', requireResearcher, (req, res) => {
  ensureStudySession(req)
  const hasCpms = String(req.body.hasCpms || '').trim()
  const cpmsId = String(req.body.cpmsId || '').trim()
  const title  = String(req.body.title || '').trim()
  const sponsor = String(req.body.sponsor || '').trim()
  const errors = {}
  if (!hasCpms) errors.hasCpms = 'Select if you have a CPMS ID'
  if (hasCpms === 'yes' && !cpmsId) errors.cpmsId = 'Enter your CPMS ID'
  if (hasCpms === 'no') {
    if (!title) errors.title = 'Enter your study title'
    if (!sponsor) errors.sponsor = 'Enter a sponsor'
  }
  if (Object.keys(errors).length) return res.status(400).render('researcher/identify-study', { errors, data: { hasCpms, cpmsId, title, sponsor } })
  req.session.study.meta = { hasCpms, cpmsId, title, sponsor }
  req.session.studyTask.identify = true
  req.session.studyTaskSavedAt = nowGB()
  res.redirect('/researcher/task-list')
})

/* ---- Step: Study details (study-details.html) ---- */
router.get('/researcher/study-details', requireResearcher, (req, res) => {
  ensureStudySession(req)
  const data = req.session.study.details || {}
  res.render('researcher/study-details', { errors: {}, data, meta: req.session.study.meta || {} })
})
router.post('/researcher/study-details', requireResearcher, (req, res) => {
  ensureStudySession(req)
  const shortName = String(req.body.shortName || '').trim()
  const laySummary = String(req.body.laySummary || '').trim()
  const start = String(req.body.recruitmentStartDate || '').trim()
  const end   = String(req.body.recruitmentEndDate || '').trim()
  const conditionsRaw = String(req.body.conditions || '').trim()
  const errors = {}
  if (!shortName) errors.shortName = 'Enter a short name'
  if (!laySummary) errors.laySummary = 'Enter a lay summary'
  if (!start) errors.startDate = 'Enter a start date'
  if (!end)   errors.endDate = 'Enter an end date'
  if (start && end && new Date(end) < new Date(start)) errors.endDate = 'End date must be after start date'
  if (Object.keys(errors).length) {
    return res.status(400).render('researcher/study-details', { errors, data: { shortName, laySummary, recruitmentStartDate: start, recruitmentEndDate: end, conditions: conditionsRaw.split(',').map(s=>s.trim()).filter(Boolean) }, meta: req.session.study.meta || {} })
  }
  const details = {
    shortName,
    laySummary,
    recruitmentStartISO: start,
    recruitmentEndISO: end,
    conditions: conditionsRaw ? conditionsRaw.split(',').map(s=>s.trim()).filter(Boolean) : []
  }
  req.session.study.details = details
  req.session.studyTask.details = true
  req.session.studyTaskSavedAt = nowGB()
  res.redirect('/researcher/task-list')
})

/* ---- Step: Select scope (select-scope.html) ---- */
router.get('/researcher/scope', requireResearcher, (req, res) => {
  ensureStudySession(req)
  const data = { scope: req.session.study.scope || [] }
  res.render('researcher/select-scope', { errors: {}, data, aliasTitle: 'Submit a study' })
})
router.post('/researcher/scope', requireResearcher, (req, res) => {
  ensureStudySession(req)
  // Handle one or more checkboxes named "scope"
  let scope = req.body.scope
  if (!Array.isArray(scope)) scope = scope ? [scope] : []
  const errors = {}
  if (scope.length === 0) errors.scope = 'Select at least one platform'
  if (Object.keys(errors).length) return res.status(400).render('researcher/select-scope', { errors, data: { scope }, aliasTitle: 'Submit a study' })
  req.session.study.scope = scope
  req.session.studyTask.scope = true
  req.session.studyTaskSavedAt = nowGB()
  res.redirect('/researcher/task-list')
})

/* ---- Step: Arms (arms.html) ---- */
router.get('/researcher/arms', requireResearcher, (req, res) => {
  ensureStudySession(req)
  const data = { hasMultiple: (req.session.study.arms && req.session.study.arms.hasMultiple) || 'no', arms: (req.session.study.arms && req.session.study.arms.arms) || [] }
  res.render('researcher/arms', { errors: {}, data })
})
router.post('/researcher/arms', requireResearcher, (req, res) => {
  ensureStudySession(req)
  const action = String(req.body.action || '')
  const hasMultiple = String(req.body.hasMultiple || 'no')
  let arms = Array.isArray(req.session.study.arms?.arms) ? [...req.session.study.arms.arms] : []
  if (action === 'add') {
    arms.push({ name: '', desc: '' })
    req.session.study.arms = { hasMultiple, arms }
    return res.render('researcher/arms', { errors: {}, data: { hasMultiple, arms } })
  }
  // Gather arrays (could come as repeated fields)
  const names = ([]).concat(req.body.armName || [])
  const descs = ([]).concat(req.body.armDesc || [])
  arms = names.map((n, i) => ({ name: String(n || '').trim(), desc: String(descs[i] || '').trim() })).filter(a => a.name)
  // Validate
  const errors = {}
  if (hasMultiple === 'yes' && arms.length === 0) errors.arms = 'Add at least one arm'
  if (Object.keys(errors).length) return res.status(400).render('researcher/arms', { errors, data: { hasMultiple, arms } })
  req.session.study.arms = { hasMultiple, arms }
  req.session.studyTask.arms = true
  req.session.studyTaskSavedAt = nowGB()
  res.redirect('/researcher/task-list')
})

/* ---- Step: Sites (sites.html) ---- */
router.get('/researcher/sites', requireResearcher, (req, res) => {
  ensureStudySession(req)
  const data = { sites: (req.session.study.sites && req.session.study.sites.sites) || [{ site:'', ods:'', email:'', needsInvite:true }] }
  res.render('researcher/sites', { errors: {}, data })
})
router.post('/researcher/sites', requireResearcher, (req, res) => {
  ensureStudySession(req)
  const action = String(req.body.action || '')
  const idx = parseInt(req.body.index || '-1', 10)
  let sites = Array.isArray(req.session.study.sites?.sites) ? [...req.session.study.sites.sites] : []
  if (sites.length === 0) sites = [{ site:'', ods:'', email:'', needsInvite:true }]

  // Update from form
  const names = ([]).concat(req.body.siteName || [])
  const ods   = ([]).concat(req.body.siteOds || [])
  const emails= ([]).concat(req.body.siteEmail || [])
  sites = names.map((n, i) => ({
    site: String(n || '').trim(),
    ods: String(ods[i] || '').trim(),
    email: String(emails[i] || '').trim(),
    needsInvite: true,
    inviteSentAt: null
  }))

  if (action === 'add') {
    sites.push({ site:'', ods:'', email:'', needsInvite:true })
    req.session.study.sites = { sites }
    return res.render('researcher/sites', { errors: {}, data: { sites } })
  }
  if (action === 'resend' && !Number.isNaN(idx) && sites[idx]) {
    sites[idx].needsInvite = true
    sites[idx].inviteSentAt = nowGB()
    req.session.study.sites = { sites }
    return res.render('researcher/sites', { errors: {}, data: { sites } })
  }

  // basic validation: at least one with email in valid format if provided
  const errors = {}
  const emailRe = /^[^@]+@[^@]+\.[^@]+$/
  let anySite = false
  sites.forEach((s, i) => {
    if (s.site || s.email || s.ods) anySite = true
    if (s.email && !emailRe.test(s.email)) { errors['email_' + i] = 'Enter a valid email' }
    // if they gave an email, consider them active (no invite needed)
    if (s.email && emailRe.test(s.email)) { s.needsInvite = false }
  })
  if (!anySite) errors.sites = 'Add at least one site'
  if (Object.keys(errors).length) return res.status(400).render('researcher/sites', { errors, data: { sites } })

  req.session.study.sites = { sites }
  req.session.studyTask.sites = true
  req.session.studyTaskSavedAt = nowGB()
  res.redirect('/researcher/task-list')
})

/* ---- Step: Ethics (ethics.html) ---- */
router.get('/researcher/ethics', requireResearcher, (req, res) => {
  ensureStudySession(req)
  const data = {
    hasEthics: (req.session.study.ethics && req.session.study.ethics.hasEthics) || '',
    approvalFile: (req.session.study.ethics && req.session.study.ethics.approvalFile) || ''
  }
  res.render('researcher/ethics', { errors: {}, data })
})
router.post('/researcher/ethics', requireResearcher, (req, res) => {
  ensureStudySession(req)
  const hasEthics = String(req.body.hasEthics || '')
  const approvalFile = String(req.body.approvalFileName || '').trim()
  const errors = {}
  if (!hasEthics) errors.hasEthics = 'Select yes or no'
  if (hasEthics === 'yes' && !approvalFile) errors.approvalFile = 'Upload your approval letter'
  if (Object.keys(errors).length) return res.status(400).render('researcher/ethics', { errors, data: { hasEthics, approvalFile } })
  req.session.study.ethics = { hasEthics, approvalFile: hasEthics === 'yes' ? approvalFile : '' }
  req.session.studyTask.ethics = true
  req.session.studyTaskSavedAt = nowGB()
  res.redirect('/researcher/task-list')
})

/* ---- Preview & Check answers (preview.html / check-answers.html) ---- */
router.get('/researcher/preview', requireResearcher, (req, res) => {
  ensureStudySession(req)
  const s = req.session.study
  res.render('researcher/preview', {
    meta: s.meta, details: s.details, scope: s.scope,
    criteria: s.criteria, arms: (s.arms && s.arms.arms) || [],
    sites: (s.sites && s.sites.sites) || [], ethics: s.ethics
  })
})
router.post('/researcher/preview', requireResearcher, (req, res) => {
  res.redirect('/researcher/check-answers')
})

router.get('/researcher/check-answers', requireResearcher, (req, res) => {
  ensureStudySession(req)
  const s = req.session.study
  const scope = s.scope || []
  const sites = (s.sites && s.sites.sites) || []
  const ethics = s.ethics || {}
  const readiness = {
    platformsSelected: Array.isArray(scope) && scope.length > 0,
    ethicsProvided: ethics.hasEthics === 'yes' && !!ethics.approvalFile,
    sitesAdded: sites.length > 0,
    activeContactPresent: sites.some(x => x && x.needsInvite === false)
  }
  res.render('researcher/check-answers', {
    meta: s.meta, details: s.details, scope,
    criteria: s.criteria, arms: (s.arms && s.arms.arms) || [],
    sites, ethics, readiness
  })
})
router.post('/researcher/check-answers', requireResearcher, (req, res) => {
  // (Prototype) "Submit" -> add to admin queue, clear task state
  ensureSeedStudies(req)
  const s = req.session.study
  const id = 'SUB' + Math.floor(Math.random() * 900000 + 100000)
  req.session.submissions.push({
    id,
    submittedAt: new Date().toISOString(),
    meta: { title: s.meta?.title || s.details?.shortName || 'Untitled', sponsor: s.meta?.sponsor || '' },
    details: {
      shortName: s.details?.shortName || '',
      laySummary: s.details?.laySummary || '',
      recruitmentStartISO: s.details?.recruitmentStartISO || '',
      recruitmentEndISO: s.details?.recruitmentEndISO || '',
      conditions: s.details?.conditions || []
    },
    scope: s.scope || [],
    criteria: Object.assign({}, s.criteria),
    arms: { hasMultiple: s.arms?.hasMultiple || 'no', arms: (s.arms?.arms || []).map(a => ({ name: a.name, desc: a.desc })) },
    sites: { sites: (s.sites?.sites || []) },
    ethics: { hasEthics: s.ethics?.hasEthics || 'no', approvalFile: s.ethics?.approvalFile || '' },
    admin: { status: 'submitted', owner: null, timeline: [{ at: nowGB(), by: 'System', action: 'Submitted', note: '' }], notes: [] }
  })

  // Reset the working copy
  req.session.study = null
  req.session.studyTask = null
  req.session.studyTaskSavedAt = nowGB()

  res.redirect('/researcher/task-list')
})

/* =========================================================================
   ADMIN: Users / Requests / Studies (kept as you had; omitted here for brevity)
   ========================================================================= */
router.get('/admin/users', requireAdmin, (req, res) => {
  ensureUsersSeed(req); ensureRequestsSeed(req)
  const q = String(req.query.q || '').trim().toLowerCase()
  let rows = req.session.users
  if (q) rows = rows.filter(u => [u.firstName, u.lastName, u.email, u.org, u.role].join(' ').toLowerCase().includes(q))
  res.render('admin/user-accounts-list', {
    user: req.session.user,
    items: rows,
    shown: rows.length,
    totalAll: 1753,
    pendingCount: (req.session.accountRequests || []).length,
    query: q,
    activeNav: 'users',
    pageH1: 'User accounts'
  })
})
router.get('/admin/requests', requireAdmin, (req, res) => {
  ensureRequestsSeed(req)
  const q = String(req.query.q || '').trim().toLowerCase()
  const all = req.session.accountRequests || []
  let items = all
  if (q) items = all.filter(r => [r.name, r.org, r.email, r.type, r.id, r.submitted].join(' ').toLowerCase().includes(q))
  res.render('admin/requests-list', { user: req.session.user, items, totalAll: all.length, shown: items.length, query: q, activeNav: 'requests', pageH1: 'Manage account requests' })
})
router.get('/admin/studies', requireAdmin, (req, res) => {
  ensureSeedStudies(req)
  const q = String(req.query.q || '').trim().toLowerCase()
  const status = String(req.query.status || '').trim()
  let rows = req.session.submissions.map(s => {
    const admin = s.admin || { status: 'submitted' }
    const submittedDate = new Date(s.submittedAt || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    return { id: s.id, title: (s.meta?.title || s.details?.shortName || 'Untitled'), sponsor: (s.meta?.sponsor || ''), scope: s.scope || [], submittedAt: s.submittedAt || '', submittedDate, status: admin.status, owner: admin.owner || '', est: s.criteria?._estCount || null, canStart: admin.status === 'submitted' }
  })
  if (q) rows = rows.filter(r => r.title.toLowerCase().includes(q) || r.sponsor.toLowerCase().includes(q) || r.id.toLowerCase().includes(q))
  if (status) rows = rows.filter(r => r.status === status)
  rows.sort((a, b) => (new Date(b.submittedAt).getTime() || 0) - (new Date(a.submittedAt).getTime() || 0))
  const counters = { submitted: 0, in_review: 0, changes_requested: 0, approved: 0, rejected: 0, live: 0 }
  req.session.submissions.forEach(s => { counters[s.admin?.status || 'submitted']++ })
  res.render('admin/studies/index', { q, status, rows, counters, activeNav: 'studies', pageH1: 'Pre-screener approvals' })
})

module.exports = router
