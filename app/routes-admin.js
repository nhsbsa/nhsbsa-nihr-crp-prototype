// app/routes-admin.js
// Admin + Researcher routes
// UPDATE: page H1s + working search on admin requests & users + Journeys hub + admin self-delete
// - Admin dashboard H1 shows "<admin name> dashboard"
// - Other admin pages receive a pageH1 describing the current section (e.g. "Manage account requests")
// - /admin/requests and /admin/users support ?q= search with shown/totalAll counts
// - Journeys hub at /epic/auth (renders views/epics/admin-researcher-signup.html)
// - Admin can self-delete account

const express = require('express')
const router = express.Router()

/* ---------------- helpers ---------------- */
function nowGB () { return new Date().toLocaleString('en-GB', { hour12: false }) }
function requireAdmin (req, res, next) {
  if (!req.session || !req.session.user) return res.redirect('/admin/sign-in')
  next()
}
function requireResearcher (req, res, next) {
  if (!req.session || !req.session.researcher) return res.redirect('/researcher/sign-in')
  next()
}
function nameFromEmail (email) {
  const local = String(email || '').split('@')[0]
  const parts = local.split(/[._-]/).filter(Boolean)
  const cap = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '')
  const name = parts.map(cap).join(' ')
  return name || 'User'
}

/* Make shared locals available to all templates */
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

/* ---------------- seeds ---------------- */
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
   AUTH – Admin
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

  const name = nameFromEmail(email)
  const parts = name.split(' ')
  // Enrich session so admin profile has data
  req.session.user = {
    name,
    email,
    signedInAt: nowGB(),
    title: 'Mrs',
    firstName: parts[0] || name,
    lastName: parts.slice(1).join(' ') || '',
    org: 'NIHR RDN',
    role: 'System administrator'
  }

  res.redirect(next)
})
router.get('/admin/logout', (req, res) => {
  req.session.user = null
  if (req.session && typeof req.session.destroy === 'function') return req.session.destroy(() => res.redirect('/admin/sign-in'))
  res.redirect('/admin/sign-in')
})

/* =========================================================================
   ADMIN: Dashboard + profile (+ self-delete)
   ========================================================================= */
router.get('/admin', requireAdmin, (req, res) => {
  // counts for card tiles
  ensureRequestsSeed(req)
  ensureSeedStudies(req)
  const accountRequestsNew = (req.session.accountRequests || []).length
  const preScreenerNew = (req.session.submissions || []).filter(s => (s.admin?.status || 'submitted') === 'submitted').length
  const adminAccountNew = 0

  res.render('admin/dashboard', {
    user: req.session.user,
    activeNav: 'dashboard',
    accountRequestsNew,
    preScreenerNew,
    adminAccountNew,
    pageH1: `${req.session.user.name} dashboard`
  })
})
router.get('/admin/profile', requireAdmin, (req, res) => {
  res.render('admin/profile', { user: req.session.user, activeNav: null, pageH1: 'Your profile' })
})
router.get('/admin/profile/delete', requireAdmin, (req, res) => {
  res.render('admin/profile-delete-confirm', { user: req.session.user, activeNav: null, pageH1: 'Delete your account' })
})
router.post('/admin/profile/delete', requireAdmin, (req, res) => {
  req.session.user = null
  res.redirect('/admin/profile/deleted')
})
router.get('/admin/profile/deleted', (req, res) => {
  res.render('admin/profile-deleted', { pageH1: 'Account deleted' })
})

/* =========================================================================
   ADMIN: Create administrator accounts
   ========================================================================= */
router.get('/admin/accounts/new', requireAdmin, (req, res) => {
  res.render('admin/create-admin-account', {
    user: req.session.user, form: {}, errors: {}, errorList: [], activeNav: 'create-admin', pageH1: 'Create an administrator account'
  })
})
router.post('/admin/accounts/new', requireAdmin, (req, res) => {
  const form = {
    title: String(req.body.title || ''),
    firstName: String(req.body.firstName || '').trim(),
    lastName: String(req.body.lastName || '').trim(),
    email: String(req.body.email || '').trim(),
    accessType: String(req.body.accessType || '')
  }
  const errors = {}, errorList = []
  if (!form.title) { errors.title = 'Select your title'; errorList.push({ text: 'Select your title', href: '#title' }) }
  if (!form.firstName) { errors.firstName = 'Enter your first name'; errorList.push({ text: 'Enter your first name', href: '#first-name' }) }
  if (!form.lastName) { errors.lastName = 'Enter your last name'; errorList.push({ text: 'Enter your last name', href: '#last-name' }) }
  if (!form.email) { errors.email = 'Enter an email address'; errorList.push({ text: 'Enter an email address', href: '#email' }) }
  else if (!/^[^@]+@[^@]+\.[^@]+$/.test(form.email)) { errors.email = 'Email address must be in a valid format'; errorList.push({ text: 'Email address must be in a valid format', href: '#email' }) }
  if (!form.accessType) { errors.accessType = 'Select the type of access this account will require'; errorList.push({ text: 'You have not chosen the type of access for this account', href: '#access-type' }) }
  if (errorList.length) {
    return res.status(400).render('admin/create-admin-account', {
      user: req.session.user, form, errors, errorList, activeNav: 'create-admin', pageH1: 'Create an administrator account'
    })
  }
  req.session.createdAdmin = { name: `${form.firstName} ${form.lastName}`, email: form.email, accessType: form.accessType }
  res.render('admin/create-admin-account-success', { user: req.session.user, created: req.session.createdAdmin, activeNav: 'create-admin', pageH1: 'Create an administrator account' })
})

/* =========================================================================
   AUTH – Researcher
   ========================================================================= */
router.get(['/researcher/start', '/start'], (req, res) => res.render('researcher/start'))
router.get('/reseacher/start', (req, res) => res.redirect('/researcher/start'))

router.get(['/researcher/sign-in', '/sign-in'], (req, res) => {
  res.render('researcher/sign-in', { errors: {}, values: { email: '' } })
})
router.get('/reseacher/sign-in', (req, res) => res.redirect('/researcher/sign-in'))

router.post(['/researcher/sign-in', '/sign-in'], (req, res) => {
  const email = String(req.body.email || '').trim()
  const password = String(req.body.password || '').trim()
  const errors = {}
  if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) errors.email = 'format'
  if (!password || password.length < 8) errors.password = 'incorrect'
  if (Object.keys(errors).length) {
    return res.status(400).render('researcher/sign-in', { errors, values: { email } })
  }
  const fullName = nameFromEmail(email)
  const parts = fullName.split(' ')
  req.session.researcher = {
    id: 'R' + Math.floor(Math.random() * 9000 + 1000),
    title: 'Mrs',
    firstName: parts[0] || 'Jane',
    lastName: parts.slice(1).join(' ') || 'Doe',
    name: fullName,
    email,
    org: 'NIHR RDN',
    role: 'Researcher',
    activeStudies: []
  }
  // Honour any shortcut destination set by the epic hub
  const nextUrl = req.session.researcherNext || '/researcher'
  req.session.researcherNext = null
  return res.redirect(nextUrl)
})
router.get(['/researcher/logout', '/logout'], (req, res) => { req.session.researcher = null; res.redirect('/researcher/sign-in') })

/* Researcher dashboard + sections + forgot password + profile/delete */
function renderSection (req, res, title, activeNav) {
  res.render('researcher/section', { me: req.session.researcher, title, activeNav })
}
router.get('/researcher', requireResearcher, (req, res) => { res.render('researcher/dashboard', { me: req.session.researcher, activeNav: 'study-mgmt' }) })
router.get('/researcher/request/new',   requireResearcher, (req, res) => renderSection(req, res, 'Create study request', 'create-request'))
router.get('/researcher/search',        requireResearcher, (req, res) => renderSection(req, res, 'Study search', 'search'))
router.get('/researcher/pre-screener',  requireResearcher, (req, res) => renderSection(req, res, 'Create pre-screener', 'pre-screener'))
router.get('/researcher/mailing-lists', requireResearcher, (req, res) => renderSection(req, res, 'View mailing lists', 'mailing'))
router.get('/researcher/reporting',     requireResearcher, (req, res) => renderSection(req, res, 'Reporting', 'reporting'))
router.get('/researcher/help',          requireResearcher, (req, res) => renderSection(req, res, 'Help', 'help'))

router.get('/researcher/password/forgot', (req, res) => { res.render('researcher/password/forgot', { errors: {}, email: '' }) })
router.post('/researcher/password/forgot', (req, res) => {
  const email = String(req.body.email || '').trim()
  const errors = {}
  if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) errors.email = 'format'
  if (Object.keys(errors).length) return res.status(400).render('researcher/password/forgot', { errors, email })
  req.session.pwReset = { email, requestedAt: nowGB(), token: Math.random().toString(36).slice(2, 10) }
  res.redirect('/researcher/password/check-email')
})
router.get('/researcher/password/check-email', (req, res) => {
  res.render('researcher/password/check-email', { email: (req.session.pwReset && req.session.pwReset.email) || '', resent: req.query.resent === '1' })
})
router.get('/researcher/password/resend', (req, res) => { if (req.session.pwReset) req.session.pwReset.requestedAt = nowGB(); res.redirect('/researcher/password/check-email?resent=1') })
router.get('/researcher/password/reset', (req, res) => { res.render('researcher/password/reset', { errors: {}, values: { password: '', confirm: '' } }) })
router.post('/researcher/password/reset', (req, res) => {
  const password = String(req.body.password || '')
  const confirm = String(req.body.confirm || '')
  const errors = {}
  if (password.length < 8) errors.password = 'min'
  if (confirm !== password) errors.confirm = 'match'
  if (Object.keys(errors).length) return res.status(400).render('researcher/password/reset', { errors, values: { password: '', confirm: '' } })
  req.session.passwordChangedAt = nowGB()
  req.session.researcher = null
  res.redirect('/researcher/password/changed')
})
router.get('/researcher/password/changed', (req, res) => { res.render('researcher/password/changed', { changedAt: req.session.passwordChangedAt || nowGB() }) })

router.get('/researcher/dev/seed-studies', requireResearcher, (req, res) => {
  req.session.researcher.activeStudies = [
    { id: 'STUDA', title: 'Study A - Diabetes in adults',   url: '#', role: 'Lead researcher', status: 'Active' },
    { id: 'STUDB', title: 'Study B - Long COVID',           url: '#', role: 'Co-researcher',   status: 'Active' },
    { id: 'STUDC', title: 'Study C - Sleep and recognition', url: '#', role: 'Co-researcher',  status: 'Active' }
  ]
  res.redirect('/researcher/profile/delete')
})
router.get('/researcher/dev/clear-studies', requireResearcher, (req, res) => { req.session.researcher.activeStudies = []; res.redirect('/researcher/profile/delete') })

router.get('/researcher/profile', requireResearcher, (req, res) => { res.render('researcher/profile', { me: req.session.researcher, activeNav: null }) })
router.get('/researcher/profile/delete', requireResearcher, (req, res) => {
  const studies = Array.isArray(req.session.researcher.activeStudies) ? req.session.researcher.activeStudies : []
  res.render('researcher/delete-confirm', { me: req.session.researcher, reason: '', activeNav: null, activeStudies: studies, hasActiveStudies: studies.length > 0, blocked: req.query.blocked === '1' })
})
router.post('/researcher/profile/delete', requireResearcher, (req, res) => {
  const studies = Array.isArray(req.session.researcher.activeStudies) ? req.session.researcher.activeStudies : []
  if (studies.length > 0) return res.redirect('/researcher/profile/delete?blocked=1')
  const reason = String(req.body.reason || '').trim()
  req.session.researcherDeletedAt = nowGB()
  req.session.researcherDeletionReason = reason
  req.session.researcher = null
  res.redirect('/researcher/profile/deleted')
})
router.get('/researcher/profile/deleted', (req, res) => { res.render('researcher/delete-done', { deletedAt: req.session.researcherDeletedAt || nowGB() }) })

/* =========================================================================
   ADMIN: Users, Requests, Studies — set pageH1s + SEARCH
   ========================================================================= */
router.get('/admin/requests', requireAdmin, (req, res) => {
  ensureRequestsSeed(req)
  const q = String(req.query.q || '').trim().toLowerCase()
  const all = req.session.accountRequests || []
  let items = all
  if (q) {
    items = all.filter(r =>
      [r.name, r.org, r.email, r.type, r.id, r.submitted].join(' ').toLowerCase().includes(q)
    )
  }
  res.render('admin/requests-list', {
    user: req.session.user,
    items,
    totalAll: all.length,
    shown: items.length,
    query: q,
    activeNav: 'requests',
    pageH1: 'Manage account requests'
  })
})

router.get('/admin/requests/:id', requireAdmin, (req, res) => {
  ensureRequestsSeed(req)
  const item = req.session.accountRequests.find(x => x.id === req.params.id)
  if (!item) return res.redirect('/admin/requests')
  res.render('admin/request-detail', { user: req.session.user, item, showOther: item.org === 'Other', activeNav: 'requests', pageH1: 'Manage account requests' })
})
router.get('/admin/requests/:id/approve', requireAdmin, (req, res) => {
  ensureRequestsSeed(req)
  const item = req.session.accountRequests.find(x => x.id === req.params.id)
  if (!item) return res.redirect('/admin/requests')
  res.render('admin/request-approve-confirm', { user: req.session.user, item, activeNav: 'requests', pageH1: 'Manage account requests' })
})
router.post('/admin/requests/:id/approve', requireAdmin, (req, res) => {
  ensureRequestsSeed(req)
  const item = req.session.accountRequests.find(x => x.id === req.params.id)
  if (!item) return res.redirect('/admin/requests')
  req.session.accountRequests = req.session.accountRequests.filter(x => x.id !== item.id)
  res.render('admin/request-approved', { user: req.session.user, item, activeNav: 'requests', pageH1: 'Manage account requests' })
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
router.post('/admin/studies/:id/start', requireAdmin, (req, res) => {
  ensureSeedStudies(req)
  const item = req.session.submissions.find(s => s.id === req.params.id)
  if (!item) return res.redirect('/admin/studies')
  item.admin = item.admin || {}
  item.admin.status = 'in_review'
  item.admin.owner = 'Admin A'
  item.admin.timeline = item.admin.timeline || []
  item.admin.timeline.unshift({ at: nowGB(), by: 'Admin A', action: 'Started review', note: '' })
  res.redirect(`/admin/studies/${item.id}`)
})
router.get('/admin/studies/:id', requireAdmin, (req, res) => {
  ensureSeedStudies(req)
  const s = req.session.submissions.find(x => x.id === req.params.id)
  if (!s) return res.redirect('/admin/studies')
  const scope = s.scope || []
  const sites = s.sites?.sites || []
  const ethics = s.ethics || {}
  const readiness = {
    platformsSelected: Array.isArray(scope) && scope.length > 0,
    ethicsProvided: ethics.hasEthics === 'yes' && !!ethics.approvalFile,
    sitesAdded: sites.length > 0,
    activeContactPresent: sites.some(x => x && x.needsInvite === false)
  }
  const canMarkLive = readiness.platformsSelected && readiness.sitesAdded && readiness.activeContactPresent && readiness.ethicsProvided
  res.render('admin/studies/show', { s, status: s.admin?.status || 'submitted', owner: s.admin?.owner || '', readiness, canMarkLive, activeNav: 'studies', pageH1: 'Pre-screener approvals' })
})
router.post('/admin/studies/:id/approve', requireAdmin, (req, res) => {
  const s = (req.session.submissions || []).find(x => x.id === req.params.id)
  if (!s) return res.redirect('/admin/studies')
  s.admin = s.admin || {}
  s.admin.status = 'approved'
  s.admin.timeline = s.admin.timeline || []
  s.admin.timeline.unshift({ at: nowGB(), by: 'Admin A', action: 'Approved', note: (req.body.note || '').trim() })
  res.redirect(`/admin/studies/${s.id}`)
})
router.post('/admin/studies/:id/reject', requireAdmin, (req, res) => {
  const s = (req.session.submissions || []).find(x => x.id === req.params.id)
  if (!s) return res.redirect('/admin/studies')
  s.admin = s.admin || {}
  s.admin.status = 'rejected'
  s.admin.timeline = s.admin.timeline || []
  s.admin.timeline.unshift({ at: nowGB(), by: 'Admin A', action: 'Rejected', note: (req.body.note || '').trim() })
  res.redirect(`/admin/studies/${s.id}`)
})
router.post('/admin/studies/:id/request-changes', requireAdmin, (req, res) => {
  const s = (req.session.submissions || []).find(x => x.id === req.params.id)
  if (!s) return res.redirect('/admin/studies')
  const reason = String(req.body.reason || '').trim()
  const detail = String(req.body.detail || '').trim()
  s.admin = s.admin || {}
  s.admin.status = 'changes_requested'
  s.admin.timeline = s.admin.timeline || []
  s.admin.timeline.unshift({ at: nowGB(), by: 'Admin A', action: 'Changes requested', note: reason + (detail ? ` — ${detail}` : '') })
  res.redirect(`/admin/studies/${s.id}`)
})
router.post('/admin/studies/:id/mark-live', requireAdmin, (req, res) => {
  const s = (req.session.submissions || []).find(x => x.id === req.params.id)
  if (!s) return res.redirect('/admin/studies')
  const scope = s.scope || []
  const sites = s.sites?.sites || []
  const ethics = s.ethics || {}
  const ok = (Array.isArray(scope) && scope.length > 0) &&
             (sites.length > 0) &&
             (sites.some(x => x && x.needsInvite === false)) &&
             (ethics.hasEthics === 'yes' && !!ethics.approvalFile)
  s.admin = s.admin || {}
  s.admin.timeline = s.admin.timeline || []
  if (!ok) { s.admin.timeline.unshift({ at: nowGB(), by: 'Admin A', action: 'Attempted to mark live (blocked)', note: 'Readiness criteria not met' }); return res.redirect(`/admin/studies/${s.id}`) }
  s.admin.status = 'live'
  s.admin.timeline.unshift({ at: nowGB(), by: 'Admin A', action: 'Marked live', note: '' })
  res.redirect(`/admin/studies/${s.id}`)
})

/* =========================================================================
   ADMIN: Users
   ========================================================================= */
router.get('/admin/users', requireAdmin, (req, res) => {
  ensureUsersSeed(req); ensureRequestsSeed(req)
  const q = String(req.query.q || '').trim().toLowerCase()
  const all = req.session.users || []
  let rows = all
  if (q) rows = all.filter(u => [u.firstName, u.lastName, u.email, u.org, u.role].join(' ').toLowerCase().includes(q))
  res.render('admin/user-accounts-list', {
    user: req.session.user,
    items: rows,
    shown: rows.length,
    totalAll: all.length,
    pendingCount: (req.session.accountRequests || []).length,
    query: q,
    activeNav: 'users',
    pageH1: 'User accounts'
  })
})
router.get('/admin/users/:id', requireAdmin, (req, res) => {
  ensureUsersSeed(req); ensureRequestsSeed(req)
  const item = req.session.users.find(u => u.id === req.params.id)
  if (!item) return res.redirect('/admin/users')
  const isResearcher = String(item.role).toLowerCase() === 'researcher'
  res.render('admin/user-profile', {
    user: req.session.user,
    item,
    pendingCount: (req.session.accountRequests || []).length,
    canChangeEmail: !isResearcher,
    activeNav: 'users',
    pageH1: 'User profile'
  })
})
router.get('/admin/users/:id/delete', requireAdmin, (req, res) => {
  ensureUsersSeed(req); ensureRequestsSeed(req)
  const item = req.session.users.find(u => u.id === req.params.id)
  if (!item) return res.redirect('/admin/users')
  res.render('admin/user-delete-confirm', { user: req.session.user, item, pendingCount: (req.session.accountRequests || []).length, activeNav: 'users', pageH1: 'Delete an account' })
})
router.post('/admin/users/:id/delete', requireAdmin, (req, res) => {
  ensureUsersSeed(req)
  const idx = req.session.users.findIndex(u => u.id === req.params.id)
  if (idx === -1) return res.redirect('/admin/users')
  const removed = req.session.users.splice(idx, 1)[0]
  req.session.lastDeletedUser = removed
  res.redirect(`/admin/users/${removed.id}/deleted`)
})
router.get('/admin/users/:id/deleted', requireAdmin, (req, res) => {
  const removed = (req.session.lastDeletedUser && req.session.lastDeletedUser.id === req.params.id) ? req.session.lastDeletedUser : null
  res.render('admin/user-delete-done', { user: req.session.user, item: removed || { id: req.params.id }, pendingCount: (req.session.accountRequests || []).length, activeNav: 'users', pageH1: 'Delete an account' })
})

/* =========================================================================
   EPIC HUB + SHORTCUTS
   ========================================================================= */

/* Hub page: render the epic cards (lives at views/epics/admin-researcher-signup.html) */
router.get('/epic/auth', (req, res) => {
  res.render('epics/admin-researcher-signup', {})
})

/* Admin shortcuts -> push to sign-in with next */
router.get('/admin/create-account', (req, res) => {
  res.redirect('/admin/sign-in?next=' + encodeURIComponent('/admin/accounts/new'))
})
router.get('/admin/manage-requests', (req, res) => {
  res.redirect('/admin/sign-in?next=' + encodeURIComponent('/admin/requests'))
})
router.get('/admin/delete-admin', (req, res) => {
  res.redirect('/admin/sign-in?next=' + encodeURIComponent('/admin/users?q=System%20administrator'))
})
router.get('/admin/delete-researcher', (req, res) => {
  res.redirect('/admin/sign-in?next=' + encodeURIComponent('/admin/users?q=Researcher'))
})

/* Researcher shortcuts -> set session next then send to sign-in */
router.get('/researcher/delete-account', (req, res) => {
  req.session.researcherNext = '/researcher/profile/delete'
  res.redirect('/researcher/sign-in')
})
router.get('/researcher/delete-account-blocked', (req, res) => {
  req.session.researcherNext = '/researcher/dev/seed-studies'
  res.redirect('/researcher/sign-in')
})

module.exports = router
