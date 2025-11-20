// Admin/Researcher sign-up epic
// - Email + password path
// - GOV.UK One Login (simulated) path
// - Profile -> Check answers -> Submitted

const express = require('express')
const crypto = require('crypto')

const router = express.Router()

// Helper: treat common checkbox payloads as "checked"
function isChecked(v) {
  if (Array.isArray(v)) return v.some(isChecked)
  return v === 'yes' || v === 'on' || v === true || v === 'true' || v === 1 || v === '1'
}

/* =========================================================================
   GOV.UK One Login – SIMULATION
   ========================================================================= */

// Start One Login auth – create state and "redirect" to provider
router.get('/auth/govuk-one-login', (req, res) => {
  const state = crypto.randomBytes(8).toString('hex')
  const returnTo = req.query.returnTo || '/signup/profile'
  if (req.session) {
    req.session.oidcState = state
    req.session.oidcReturnTo = returnTo
  }
  const redirectUri = encodeURIComponent('/auth/govuk-one-login/callback')
  return res.redirect(`/one-login/authorize?client_id=nihr-prototype&redirect_uri=${redirectUri}&state=${state}`)
})

// Simulated provider: Authorize screen (enter email)
router.get('/one-login/authorize', (req, res) => {
  const { state = '', redirect_uri = '/auth/govuk-one-login/callback' } = req.query
  res.render('one-login/email', { state, redirectUri: redirect_uri })
})

// Email submitted -> pretend we send a code, move to code page
router.post('/one-login/send-code', (req, res) => {
  const { email = '', state = '', redirectUri = '/auth/govuk-one-login/callback' } = req.body || {}
  const trimmed = (email || '').trim().toLowerCase()
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
  if (!emailOk) {
    return res.status(400).render('one-login/email', {
      errors: { email: 'Enter an email address in the correct format, like someone@example.com' },
      email: trimmed, state, redirectUri
    })
  }
  if (req.session) req.session.oneLoginEmail = trimmed
  return res.redirect(`/one-login/enter-code?state=${encodeURIComponent(state)}&redirect_uri=${encodeURIComponent(redirectUri)}`)
})

// Show code entry (renders one-login/send-code.html)
router.get('/one-login/enter-code', (req, res) => {
  const { state = '', redirect_uri = '/auth/govuk-one-login/callback' } = req.query
  const email = (req.session && req.session.oneLoginEmail) ? req.session.oneLoginEmail : ''
  res.render('one-login/send-code', { state, redirectUri: redirect_uri, email })
})

// Handle accidental GETs to /one-login/verify-code (redirect to entry page)
router.get('/one-login/verify-code', (req, res) => {
  const { state = '', redirect_uri = '/auth/govuk-one-login/callback' } = req.query
  return res.redirect(`/one-login/enter-code?state=${encodeURIComponent(state)}&redirect_uri=${encodeURIComponent(redirect_uri)}`)
})

// Verify code (simulate) -> redirect back to your service with ?code & ?state
router.post('/one-login/verify-code', (req, res) => {
  const { code = '', state = '', redirectUri = '/auth/govuk-one-login/callback' } = req.body || {}
  const trimmed = (code || '').replace(/\s+/g, '')
  if (!/^\d{6}$/.test(trimmed)) {
    const email = (req.session && req.session.oneLoginEmail) ? req.session.oneLoginEmail : ''
    return res.status(400).render('one-login/send-code', {
      errors: { code: 'Enter the 6 digit security code' },
      code: trimmed, state, redirectUri, email
    })
  }
  return res.redirect(`${redirectUri}?code=fake_auth_code&state=${encodeURIComponent(state)}`)
})

// Callback handler – be lenient in prototype: always continue to profile
router.get('/auth/govuk-one-login/callback', (req, res) => {
  const email = (req.session && req.session.oneLoginEmail) ? req.session.oneLoginEmail : ''
  if (req.session) {
    req.session.accountEmail = email
    req.session.oneLoginSignedIn = true
    delete req.session.oidcState
    delete req.session.oneLoginEmail
  }
  const returnTo = (req.session && req.session.oidcReturnTo) || '/signup/profile'
  if (req.session) delete req.session.oidcReturnTo
  return res.redirect(`${returnTo}?email=${encodeURIComponent(email)}`)
})

/* =========================================================================
   Email + Password signup path
   ========================================================================= */

router.get('/signup/email', (req, res) => {
  res.render('auth/email-signup', { data: {}, errors: {} })
})

router.post('/signup/email', (req, res) => {
  const body = req.body || {}
  const rawEmail = (body.email ?? '').trim()
  const email = rawEmail.toLowerCase()
  const password = body.password ?? ''

  const errors = {}
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  if (!emailOk) errors.email = 'Enter an email address in the correct format, like someone@nihr.ac.uk'

  const passOk = /^(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password)
  if (!passOk) {
    errors.password = 'Your password does not meet requirements. Please use a password with 8+ characters, at least 1 number and 1 special character'
  }

  if (Object.keys(errors).length) {
    return res.status(400).render('auth/email-signup', { errors, data: { email } })
  }

  if (req.session) req.session.accountEmail = email
  return res.redirect(`/signup/verify-email?email=${encodeURIComponent(email)}`)
})

/* Verify email (countdown → profile) */
router.get('/signup/verify-email', (req, res) => {
  const email = ((req.query.email || (req.session && req.session.accountEmail) || '') + '').trim()
  const timerSeconds = Math.max(0, parseInt(req.query.t || '8', 10) || 8)
  res.render('auth/verify-email', { email, timerSeconds })
})

router.get('/signup/request-another', (req, res) => {
  const email = ((req.query.email || (req.session && req.session.accountEmail) || '') + '').trim()
  res.render('auth/verify-email', { email, timerSeconds: 8, resent: true })
})

/* Tell us about yourself (profile) */
router.get('/signup/profile', (req, res) => {
  const saved = (req.session && req.session.profile) || {}
  const email = ((saved.email || req.query.email || (req.session && req.session.accountEmail) || '') + '').trim()
  res.render('auth/profile', { data: { ...saved, email }, errors: {} })
})

router.post('/signup/profile', (req, res) => {
  const body = req.body || {}
  const title = (body.title || '').trim()
  const firstName = (body.firstName || '').trim()
  const lastName = (body.lastName || '').trim()
  const email = ((body.email || '').trim()).toLowerCase()
  const organisationRaw = (body.organisation || '').trim()
  const organisation = organisationRaw
  const organisationKey = organisationRaw.toLowerCase()

  const orgName = (body.orgName || '').trim()
  const orgJustification = (body.orgJustification || '').trim()
  const agree = body.agree
  const consent = body.consent

  const errors = {}

  if (!title) errors.title = 'Select a title'
  if (!firstName) errors.firstName = 'Enter your first name'
  if (!lastName) errors.lastName = 'Enter your last name'

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  if (!emailOk) errors.email = 'Enter an email address in the correct format, like someone@nihr.ac.uk'

  if (!organisation) errors.organisation = 'Select an organisation'
  if (organisationKey === 'other') {
    if (!orgName) errors.orgName = 'Enter your organisation name'
    if (!orgJustification) errors.orgJustification = 'Provide justification for using the platform'
  }

  if (!isChecked(agree)) errors.agree = 'You must agree to the terms and conditions'
  if (!isChecked(consent)) errors.consent = 'You must consent to use of your data'

  if (Object.keys(errors).length) {
    return res.status(400).render('auth/profile', {
      errors,
      data: { title, firstName, lastName, email, organisation, orgName, orgJustification, agree, consent }
    })
  }

  if (req.session) {
    req.session.profile = {
      title, firstName, lastName,
      email,
      organisation,
      orgName,
      orgJustification,
      agree: isChecked(agree) ? 'yes' : 'no',
      consent: isChecked(consent) ? 'yes' : 'no'
    }
  }

  return res.redirect('/signup/check-answers')
})

/* Check your answers */
router.get('/signup/check-answers', (req, res) => {
  const profile = (req.session && req.session.profile) || {}
  if (!profile || !profile.email) return res.redirect('/signup/profile')
  res.render('auth/check-answers', { profile })
})

router.post('/signup/check-answers', (req, res) => {
  return res.redirect('/signup/submitted')
})

/* Registration submitted (confirmation) */
router.get('/signup/submitted', (req, res) => {
  res.render('auth/submitted')
})

module.exports = router
