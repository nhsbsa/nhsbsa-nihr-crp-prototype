// app/researcher-identify-study.js
const express = require('express')
const router = express.Router()

// Prototype-only “taken” IDs to trigger the duplicate UI
const DUPES = new Set(['123456', 'CPMS-0001', '999999'])

function ensureSubmit(req) {
  const data = req.session.data || (req.session.data = {})
  data.submit ||= {}
  data.submit.study ||= {
    portfolioStatus: '',
    cpmsId: '',
    name: '',
    ciTitle: '',
    ciName: '',
    coordinator: { name: '', email: '' },
    sponsor: '',
    funder: '',
    cro: '',
    nihrFundingStream: '',
    // ethics
    ethicsApproval: '',
    recNumber: ''
  }
  data.status ||= {}
  data.meta ||= {}
  return data
}

function nowGB() {
  return new Date().toLocaleString('en-GB', { hour12: false })
}

function lookupCPMS(id) {
  const db = {
    '123456': { name: 'Cognitive Health Study', ciTitle: 'Dr', ciName: 'Alice Example', sponsor: 'University of Oxford', funder: 'NIHR', cro: '', nihrFundingStream: 'HTA' }
  }
  return db[id] || null
}

router.get('/researcher/identify-study', (req, res) => {
  const data = ensureSubmit(req)
  res.render('researcher/identify-study.html', {
    activeNav: 'create-request',
    data,
    model: data.submit.study
  })
})

// Persist ethics fields even when using the CPMS lookup button
router.post('/researcher/identify-study/lookup', (req, res) => {
  const data = ensureSubmit(req)
  const m = data.submit.study
  const b = req.body || {}

  // Persist current selections
  m.portfolioStatus = (b.portfolioStatus || '').trim()
  m.cpmsId = (b.cpmsId || '').trim()

  // Persist ethics fields during lookup so they aren’t lost
  const ea = String(b.ethicsApproval || m.ethicsApproval || '').trim().toLowerCase()
  m.ethicsApproval = ea === 'yes' ? 'yes' : ea === 'no' ? 'no' : ''
  m.recNumber = m.ethicsApproval === 'yes' ? String(b.recNumber || m.recNumber || '').trim() : ''

  if (m.portfolioStatus === 'yes') {
    if (!m.cpmsId) {
      data.meta.lastSaved = nowGB()
      return res.render('researcher/identify-study.html', {
        activeNav: 'create-request',
        data,
        model: m,
        errors: [{ href: '#cpmsId', text: 'Enter your CPMS ID' }]
      })
    }
    if (DUPES.has(m.cpmsId)) {
      data.meta.lastSaved = nowGB()
      return res.render('researcher/identify-study.html', {
        activeNav: 'create-request',
        data,
        model: m,
        cpmsDuplicate: true
      })
    }
    const found = lookupCPMS(m.cpmsId)
    if (found) Object.assign(m, found)
  }

  data.meta.lastSaved = nowGB()
  return res.redirect('/researcher/identify-study')
})

router.post('/researcher/identify-study', (req, res) => {
  const data = ensureSubmit(req)
  const m = data.submit.study
  const b = req.body || {}
  const errors = []

  // Map fields
  m.portfolioStatus = (b.portfolioStatus || '').trim()
  m.cpmsId = (b.cpmsId || '').trim()
  m.name = (b.name || '').trim()
  m.ciTitle = (b.ciTitle || '').trim()
  m.ciName = (b.ciName || '').trim()
  m.coordinator ||= { name: '', email: '' }
  m.coordinator.name = (b.coordName || '').trim()
  m.coordinator.email = (b.coordEmail || '').trim()
  m.sponsor = (b.sponsor || '').trim()
  m.funder = (b.funder || '').trim()
  m.cro = (b.cro || '').trim()
  m.nihrFundingStream = (b.nihrFundingStream || '').trim()

  // Ethics: normalise and conditionally persist recNumber
  const ea = String(b.ethicsApproval || '').trim().toLowerCase()
  m.ethicsApproval = ea === 'yes' ? 'yes' : ea === 'no' ? 'no' : ''
  m.recNumber = m.ethicsApproval === 'yes' ? String(b.recNumber || '').trim() : ''

  // Minimal validation for ethics
  if (!m.ethicsApproval) {
    errors.push({ href: '#ethicsApproval', text: 'Select if you have ethics approval' })
  } else if (m.ethicsApproval === 'yes' && !m.recNumber) {
    errors.push({ href: '#recNumber', text: 'Enter your REC / Ethics number' })
  }

  if (errors.length) {
    data.meta.lastSaved = nowGB()
    return res.render('researcher/identify-study.html', {
      activeNav: 'create-request',
      data,
      model: m,
      errors
    })
  }

  data.status['/researcher/identify-study'] = 'completed'
  data.meta.lastSaved = nowGB()
  return res.redirect('/researcher/study-info')
})

module.exports = router
