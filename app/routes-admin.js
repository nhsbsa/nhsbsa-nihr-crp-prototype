// Admin: manage account requests epic
const express = require('express')
const router = express.Router()

// --- Helpers ---
function titleCaseNameFromEmail(email) {
  const local = (email || '').split('@')[0]
  if (!local) return 'NIHR Admin'
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')
}

// Seed requests to mirror your screenshots
const pendingRequests = [
  { id: 'req1', name: 'John Smith',    org: 'University of Birmingham',          type: 'Researcher', submitted: '6 August 2025', email: 'john.smith@bham.ac.uk' },
  { id: 'req2', name: 'Chloe Williams', org: "Alzheimer's Research UK",          type: 'Researcher', submitted: '6 August 2025', email: 'chloe@alzres.org' },
  { id: 'req3', name: 'Ben Sharp',      org: 'Manchester University NHS Trust',  type: 'Researcher', submitted: '6 August 2025', email: 'ben.sharp@manchester.nhs.uk' },
  { id: 'req4', name: 'Darren Cooke',   org: 'Manchester University',            type: 'Researcher', submitted: '6 August 2025', email: 'darren@manchester.ac.uk' },
  { id: 'req5', name: 'Toby Travis',    org: 'Manchester University NHS Trust',  type: 'Researcher', submitted: '6 August 2025', email: 'toby.travis@manchester.nhs.uk' },
  { id: 'req6', name: 'Guy Slater',     org: 'Manchester University NHS Trust',  type: 'Researcher', submitted: '6 August 2025', email: 'guy.slater@manchester.nhs.uk' },
  { id: 'req7', name: 'Paul Jackson',   org: 'Manchester University NHS Trust',  type: 'Researcher', submitted: '6 August 2025', email: 'paul.jackson@manchester.nhs.uk' }
]

// Convenience aliases so hub links still work
router.get('/admin/manage-requests', (req, res) => res.redirect('/admin/requests'))
router.get('/admin/create-account', (req, res) => res.redirect('/admin/sign-in'))

/* =========================================================================
   NIHR Google ID – simulated OAuth
   ========================================================================= */

// Entry page: shows the “Sign in with NIHR Google ID” button
router.get('/admin/sign-in', (req, res) => {
  res.render('admin/sign-in')
})

// Start “OAuth”: remember where to return, then show email entry screen
router.get('/admin/google/start', (req, res) => {
  const returnTo = req.query.returnTo || '/admin/requests'
  if (req.session) req.session.adminReturnTo = returnTo
  res.render('admin/google-signin', { errors: {}, email: '' })
})

// Submit email to “Google”, validate, then “callback” back to app
router.post('/admin/google/verify', (req, res) => {
  const email = (req.body?.email || '').trim().toLowerCase()
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  if (!emailOk) {
    return res.status(400).render('admin/google-signin', {
      errors: { email: 'Enter your NIHR Google email address' },
      email
    })
  }

  // Create a user from the email (or use a fixed one if you prefer)
  const name = titleCaseNameFromEmail(email) || 'Claire Smith'
  if (req.session) {
    req.session.adminUser = { name, email }
  }
  const dest = req.session?.adminReturnTo || '/admin/requests'
  if (req.session) delete req.session.adminReturnTo
  return res.redirect(dest)
})

/* =========================================================================
   Admin: list / detail / approve confirm / approved
   ========================================================================= */

router.get('/admin/requests', (req, res) => {
  if (!req.session?.adminUser) return res.redirect('/admin/sign-in')
  res.render('admin/requests-list', {
    user: req.session.adminUser,
    items: pendingRequests,
    total: pendingRequests.length
  })
})

router.get('/admin/requests/:id', (req, res) => {
  if (!req.session?.adminUser) return res.redirect('/admin/sign-in')
  const item = pendingRequests.find(r => r.id === req.params.id)
  if (!item) return res.redirect('/admin/requests')

  const showOther = (req.query.org || '').toLowerCase() === 'other'
  res.render('admin/request-detail', {
    user: req.session.adminUser,
    item,
    showOther,
    otherOrgName: 'Other – (insert other organisation name)',
    justification: "I've been given authority by my superior to use this platform as I am planning to conduct research studies."
  })
})

router.get('/admin/requests/:id/approve', (req, res) => {
  if (!req.session?.adminUser) return res.redirect('/admin/sign-in')
  const item = pendingRequests.find(r => r.id === req.params.id)
  if (!item) return res.redirect('/admin/requests')
  res.render('admin/request-approve-confirm', { user: req.session.adminUser, item })
})

router.post('/admin/requests/:id/approve', (req, res) => {
  if (!req.session?.adminUser) return res.redirect('/admin/sign-in')
  const idx = pendingRequests.findIndex(r => r.id === req.params.id)
  if (idx === -1) return res.redirect('/admin/requests')
  const approved = pendingRequests.splice(idx, 1)[0]
  res.redirect(`/admin/requests/${approved.id}/approved`)
})

router.get('/admin/requests/:id/approved', (req, res) => {
  if (!req.session?.adminUser) return res.redirect('/admin/sign-in')
  res.render('admin/request-approved', { user: req.session.adminUser })
})

router.get('/admin/logout', (req, res) => {
  if (req.session) req.session.adminUser = null
  res.redirect('/admin/sign-in')
})

module.exports = router
