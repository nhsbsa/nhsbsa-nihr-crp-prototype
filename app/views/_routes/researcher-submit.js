// app/researcher-submit.js
const express = require('express')
const router = express.Router()

/* ==============================
   Session/data scaffolding
   ============================== */
function ensureSubmit(req) {
  const data = req.session.data || (req.session.data = {})

  data.submit ||= {}

  // B1: Identify study
  data.submit.study ||= {
    name: '',
    ciTitle: '',
    ciName: '',
    sponsor: '',
    funder: '',
    cro: '',
    nihrFundingStream: '',
    portfolioStatus: '',   // 'yes' | 'no' | 'not-yet'
    cpmsId: '',
    coordinator: { name: '', email: '' }
  }

  // B2: Lay info
  data.submit.info ||= { background: '', participants: '', whatInvolves: '' }

  // B3: Recruitment
  data.submit.recruitment ||= {
    isOpen: '', recruitedToDate: '', startDate: '', endDate: '', overallTarget: ''
  }

  // B4: Study design
  data.submit.design ||= {
    randomised: '',       // 'yes' | 'no'
    studyKind: '',        // 'interventional' | 'observational'
    phase: '',            // one of STUDY_PHASES
    typeTags: []          // multi-select tags
  }

  // B5: Study sites
  data.submit.sites ||= { list: [] }

  // B6: Feedback & contact
  data.submit.feedback ||= {
    source: [],
    contactForFeedback: '',
    contactForResearch: ''
  }

  // Utility/context
  data.status ||= {}
  data.meta ||= {}
  data.feasibility ||= {}

  return data
}

const lastSaved = d => d.meta.lastSaved = new Date().toLocaleString('en-GB', { hour12: false })
const mark = (d, path, state = 'completed') => { d.status[path] = state; lastSaved(d) }
const toIntOrEmpty = v => {
  const n = parseInt(String(v || '').trim(), 10)
  return Number.isFinite(n) ? n : ''
}
const toArr = v => Array.isArray(v) ? v : (v ? [v] : [])

/* ---------- mock CPMS lookup (dummy data) ---------- */
function lookupCPMS(id) {
  const db = {
    '123456': {
      name: 'Cognitive Health Study',
      ciTitle: 'Dr',
      ciName: 'Alice Example',
      sponsor: 'University of Oxford',
      funder: 'NIHR',
      cro: 'None / Not applicable',
      nihrFundingStream: 'NIHR-ABC-2025-001',
      info: {
        background: 'We are studying memory and thinking in adults.',
        participants: 'Adults aged 50 and over living in England.',
        whatInvolves: 'Online questionnaires and a short in-person assessment.'
      }
    },
    '654321': {
      name: 'Movement Disorders Registry',
      ciTitle: 'Prof',
      ciName: 'Brian Example',
      sponsor: 'Leeds Teaching Hospitals NHS Trust',
      funder: 'CRUK',
      cro: 'IQVIA',
      nihrFundingStream: '',
      info: {
        background: 'A registry to better understand movement disorders.',
        participants: 'People diagnosed with Parkinson’s or similar conditions.',
        whatInvolves: 'Consent to share clinical data and optional follow-ups.'
      }
    }
  }
  return db[String(id || '').trim()] || null
}

/* =========================================================
   B1: Identify the study — session-safe + CPMS flow
   ========================================================= */
router.get('/researcher/identify-study', (req, res) => {
  const data = ensureSubmit(req)
  const m = { ...data.submit.study }
  res.render('researcher/identify-study.html', {
    activeNav: 'create-request',
    data,
    model: m,
    flash: null,
    cpmsResult: null
  })
})

router.post('/researcher/identify-study', (req, res) => {
  const data = ensureSubmit(req)
  const b = req.body || {}
  const m = data.submit.study
  const action = (b._action || '').trim() // << read _action from the form

  // capture fields on every post
  m.name = (b.name || '').trim()
  m.ciTitle = (b.ciTitle || '').trim()
  m.ciName = (b.ciName || '').trim()
  m.sponsor = (b.sponsor || '').trim()
  m.funder = (b.funder || '').trim()
  m.cro = (b.cro || '').trim()
  m.nihrFundingStream = (b.nihrFundingStream || '').trim()
  m.portfolioStatus = (b.portfolioStatus || '').trim()
  m.cpmsId = (b.cpmsId || '').trim()
  m.coordinator = {
    name: (b.coordName || '').trim(),
    email: (b.coordEmail || '').trim()
  }

  const saveThen = fn => {
    // Prototype Kit cookie sessions don’t have save()
    if (typeof req.session.save === 'function') req.session.save(fn)
    else fn()
  }

  // Check CPMS: show a summary only, do not mutate fields
  if (action === 'lookup') {
    let flash = null
    let cpmsResult = null

    if (m.portfolioStatus !== 'yes') {
      flash = { type: 'warning', heading: 'Check CPMS', text: 'Select “Yes” before entering a CPMS ID.' }
    } else if (!m.cpmsId) {
      flash = { type: 'warning', heading: 'Check CPMS', text: 'Enter a CPMS ID to check.' }
    } else {
      const rec = lookupCPMS(m.cpmsId)
      if (rec) {
        flash = { type: 'success', heading: 'CPMS record found', text: 'Review the summary below or click “Use these CPMS details”.' }
        cpmsResult = {
          name: rec.name,
          ci: `${rec.ciTitle} ${rec.ciName}`,
          sponsor: rec.sponsor,
          funder: rec.funder,
          cro: rec.cro,
          nihrFundingStream: rec.nihrFundingStream,
          info: rec.info
        }
      } else {
        flash = { type: 'warning', heading: 'No record found', text: 'Nothing matched that CPMS ID. You can continue and complete details manually.' }
      }
    }

    lastSaved(data)
    return saveThen(() => {
      res.render('researcher/identify-study.html', {
        activeNav: 'create-request',
        data,
        model: { ...m },
        flash,
        cpmsResult
      })
    })
  }

  // Apply CPMS: hard copy dummy data into the form fields
  if (action === 'applyCpms') {
    let flash = null
    const rec = m.cpmsId ? lookupCPMS(m.cpmsId) : null
    if (rec) {
      m.name = rec.name
      m.ciTitle = rec.ciTitle
      m.ciName = rec.ciName
      m.sponsor = rec.sponsor
      m.funder = rec.funder
      m.cro = rec.cro
      m.nihrFundingStream = rec.nihrFundingStream
      // also prefill study info
      data.submit.info.background = rec.info.background
      data.submit.info.participants = rec.info.participants
      data.submit.info.whatInvolves = rec.info.whatInvolves
      flash = { type: 'success', heading: 'Applied', text: 'CPMS details applied to the form.' }
    } else {
      flash = { type: 'warning', heading: 'Nothing to apply', text: 'No CPMS record to apply.' }
    }

    lastSaved(data)
    return saveThen(() => {
      res.render('researcher/identify-study.html', {
        activeNav: 'create-request',
        data,
        model: { ...m },
        flash,
        cpmsResult: null
      })
    })
  }

  // Primary CTA: Save and continue (no blocking validation here)
  mark(data, '/researcher/identify-study')
  return res.redirect('/researcher/study-info')
})

/* =========================================================
   B2: Study information (layperson)
   ========================================================= */
router.get('/researcher/study-info', (req, res) => {
  const data = ensureSubmit(req)
  res.render('researcher/study-info.html', {
    activeNav: 'create-request',
    data,
    model: data.submit.info,
    errors: []
  })
})

router.post('/researcher/study-info', (req, res) => {
  const data = ensureSubmit(req)
  const m = data.submit.info
  m.background = (req.body.background || '').trim()
  m.participants = (req.body.participants || '').trim()
  m.whatInvolves = (req.body.whatInvolves || '').trim()

  const errors = []
  if (!m.background) errors.push({ href: '#background', text: 'Provide a short background in plain English' })
  if (!m.participants) errors.push({ href: '#participants', text: 'Describe who you are looking for' })
  if (!m.whatInvolves) errors.push({ href: '#whatInvolves', text: 'Explain what the study involves' })

  if (errors.length) {
    return res.render('researcher/study-info.html', {
      activeNav: 'create-request',
      data,
      model: m,
      errors
    })
  }

  mark(data, '/researcher/study-info')
  res.redirect('/researcher/recruitment')
})

/* =========================================================
   B3: Recruitment criteria
   ========================================================= */
router.get('/researcher/recruitment', (req, res) => {
  const data = ensureSubmit(req)
  res.render('researcher/recruitment.html', {
    activeNav: 'create-request',
    data,
    model: data.submit.recruitment,
    errors: []
  })
})

router.post('/researcher/recruitment', (req, res) => {
  const data = ensureSubmit(req)
  const m = data.submit.recruitment
  const b = req.body || {}

  m.isOpen = (b.isOpen || '').trim()
  m.recruitedToDate = toIntOrEmpty(b.recruitedToDate)
  m.startDate = (b.startDate || '').trim()
  m.endDate = (b.endDate || '').trim()
  m.overallTarget = toIntOrEmpty(b.overallTarget)

  const errors = []
  if (!m.isOpen) errors.push({ href: '#isOpen-yes', text: 'Select if the study is already open to recruitment' })
  if (m.isOpen === 'yes' && m.recruitedToDate === '') {
    errors.push({ href: '#recruitedToDate', text: 'Enter the number recruited to date' })
  }
  if (!m.startDate) errors.push({ href: '#startDate', text: 'Enter a recruitment start date' })
  if (!m.endDate) errors.push({ href: '#endDate', text: 'Enter a recruitment end date' })
  if (m.overallTarget === '') errors.push({ href: '#overallTarget', text: 'Enter an overall recruitment target' })

  if (errors.length) {
    return res.render('researcher/recruitment.html', {
      activeNav: 'create-request',
      data,
      model: m,
      errors
    })
  }

  mark(data, '/researcher/recruitment')
  res.redirect('/researcher/study-design')
})

/* =========================================================
   B4: Study design
   ========================================================= */
const STUDY_PHASES = ['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4', 'Not applicable']
const STUDY_TYPE_TAGS = [
  'Blood donation',
  'Blood tests/sample',
  'Brain scan',
  'Community programme',
  'Computer based testing',
  'Dementia risk factors',
  'Drug/medication trial',
  'Face to face interview',
  'Focus group',
  'Genetics',
  'Investigating dementia causes',
  'Lifestyle programme',
  'Lumbar puncture',
  'Offline questionnaire',
  'Online questionnaire',
  'Online study',
  'Other',
  'Phone app testing',
  'Physical tests/assessments',
  'Physical therapy',
  'Talking therapy',
  'Telephone/online interview',
  'Thinking and memory tests',
  'Trying new technologies and devices',
  'Vaccine trial'
]

router.get('/researcher/study-design', (req, res) => {
  const data = ensureSubmit(req)
  res.render('researcher/study-design.html', {
    activeNav: 'create-request',
    data,
    model: data.submit.design,
    phases: STUDY_PHASES,
    typeTags: STUDY_TYPE_TAGS,
    errors: []
  })
})

router.post('/researcher/study-design', (req, res) => {
  const data = ensureSubmit(req)
  const m = data.submit.design
  m.randomised = (req.body.randomised || '').trim()
  m.studyKind = (req.body.studyKind || '').trim()
  m.phase = (req.body.phase || '').trim()
  m.typeTags = toArr(req.body.typeTags)

  const errors = []
  if (!m.randomised) errors.push({ href: '#randomised-yes', text: 'Select if the study is randomised' })
  if (!m.studyKind) errors.push({ href: '#kind-interventional', text: 'Select interventional or observational' })
  if (!m.phase) errors.push({ href: '#phase', text: 'Select a study phase' })

  if (errors.length) {
    return res.render('researcher/study-design.html', {
      activeNav: 'create-request',
      data,
      model: m,
      phases: STUDY_PHASES,
      typeTags: STUDY_TYPE_TAGS,
      errors
    })
  }

  mark(data, '/researcher/study-design')
  res.redirect('/researcher/study-sites')
})

/* =========================================================
   B5: Study sites (prefill from Feasibility)
   ========================================================= */
router.get('/researcher/study-sites', (req, res) => {
  const data = ensureSubmit(req)

  // Prefill only if Section B has no sites yet, but Feasibility has sites
  const bSites = data.submit.sites
  const aSites = (data.feasibility && data.feasibility.sites && data.feasibility.sites.list) || []

  if ((!bSites.list || bSites.list.length === 0) && Array.isArray(aSites) && aSites.length > 0) {
    bSites.list = aSites
      .filter(s => s && (s.name || s.code))
      .map(s => ({
        name: s.name || s.code || 'Unnamed site',
        piName: '',
        piEmail: '',
        contactName: '',
        contactEmail: ''
      }))
    data.status['/researcher/study-sites'] = 'in-progress'
    lastSaved(data)
  }

  res.render('researcher/study-sites.html', {
    activeNav: 'create-request',
    data,
    model: data.submit.sites,
    errors: []
  })
})

router.post('/researcher/study-sites', (req, res) => {
  const data = ensureSubmit(req)
  const sites = data.submit.sites
  const b = req.body || {}

  if (b.list && Array.isArray(b.list)) {
    sites.list = b.list.map((row, idx) => {
      const existing = (sites.list && sites.list[idx]) || {}
      return {
        name: (row.name && row.name.trim()) || existing.name || 'Unnamed site',
        piName: (row.piName || '').trim(),
        piEmail: (row.piEmail || '').trim(),
        contactName: (row.contactName || '').trim(),
        contactEmail: (row.contactEmail || '').trim()
      }
    })
  }

  if (b.addSite === 'yes') {
    const item = {
      name: (b.name || '').trim(),
      piName: (b.piName || '').trim(),
      piEmail: (b.piEmail || '').trim(),
      contactName: (b.contactName || '').trim(),
      contactEmail: (b.contactEmail || '').trim()
    }
    if (item.name || item.piName || item.piEmail || item.contactName || item.contactEmail) {
      sites.list = sites.list || []
      sites.list.push(item)
      data.status['/researcher/study-sites'] = 'in-progress'
      lastSaved(data)
    }
    return res.redirect('/researcher/study-sites')
  }

  if (typeof b.removeIndex !== 'undefined' && b.removeIndex !== '') {
    const idx = parseInt(b.removeIndex, 10)
    if (Number.isInteger(idx) && sites.list && sites.list[idx]) {
      sites.list.splice(idx, 1)
      lastSaved(data)
    }
    return res.redirect('/researcher/study-sites')
  }

  const errors = []
  if (!sites.list || sites.list.length === 0) {
    errors.push({ href: '#add-site-block', text: 'Add at least one study site' })
  } else {
    sites.list.forEach((s, i) => {
      if (!s.name) errors.push({ href: `#row-${i}`, text: `Site ${i + 1}: missing site name` })
    //  if (!s.piName) errors.push({ href: `#row-${i}-piName`, text: `Site ${i + 1}: enter a PI name` })
    //  if (!s.piEmail) errors.push({ href: `#row-${i}-piEmail`, text: `Site ${i + 1}: enter a PI email` })
    })
  }

  if (errors.length) {
    return res.render('researcher/study-sites.html', {
      activeNav: 'create-request',
      data,
      model: sites,
      errors
    })
  }

  mark(data, '/researcher/study-sites')
  res.redirect('/researcher/feedback')
})

/* =========================================================
   B6: Feedback & contact
   ========================================================= */
const FEEDBACK_SOURCES = [
  'NIHR newsletter',
  'Colleague/word of mouth',
  'Conference or event',
  'Search engine',
  'Social media',
  'Be Part of Research website',
  'Other'
]

router.get('/researcher/feedback', (req, res) => {
  const data = ensureSubmit(req)
  res.render('researcher/feedback.html', {
    activeNav: 'create-request',
    data,
    model: data.submit.feedback,
    sources: FEEDBACK_SOURCES,
    errors: []
  })
})

router.post('/researcher/feedback', (req, res) => {
  const data = ensureSubmit(req)
  const m = data.submit.feedback
  m.source = toArr(req.body.source)
  m.contactForFeedback = (req.body.contactForFeedback || '').trim()
  m.contactForResearch = (req.body.contactForResearch || '').trim()

  const errors = []
  if (!m.contactForFeedback) errors.push({ href: '#contactForFeedback-yes', text: 'Tell us if we can contact you for feedback' })
  if (!m.contactForResearch) errors.push({ href: '#contactForResearch-yes', text: 'Tell us if we can contact you about user research' })

  if (errors.length) {
    return res.render('researcher/feedback.html', {
      activeNav: 'create-request',
      data,
      model: m,
      sources: FEEDBACK_SOURCES,
      errors
    })
  }

  mark(data, '/researcher/feedback')
  res.redirect('/researcher/matching-criteria')
})

/* =========================================================
   B7: Matching criteria (from Section A)
   ========================================================= */
router.get('/researcher/matching-criteria', (req, res) => {
  const data = ensureSubmit(req)

  const feas = data.feasibility || {}
  const feasResultsState = data.status && data.status['/researcher/feasibility/results']
  const feasDone =
    !!feas.completed ||
    !!feas.totalEstimate ||
    feasResultsState === 'completed' ||
    feasResultsState === 'in-progress'

  data.status['/researcher/matching-criteria'] = feasDone ? 'completed' : 'cannot-start'
  data.meta.lastSaved = new Date().toLocaleString('en-GB', { hour12: false })

  const s  = feas.sites || { list: [], defaultRadius: 10 }
  const d  = feas.demographics || {}
  const dx = feas.diagnoses || { values: [] }
  const de = feas.demographicsExtended || { ethnicity: [], gender: [], sexAtBirth: [] }
  const med = feas.medical || { include: [], exclude: [] }
  const dis = feas.disabilities || { include: [], exclude: [] }
  const other = feas.other || {}

  const model = {
    sites: s,
    diagnoses: dx.values,
    demographics: d,
    demographicsExtended: de,
    medical: med,
    disabilities: dis,
    other
  }

  res.render('researcher/matching-criteria.html', {
    activeNav: 'create-request',
    data,
    model
  })
})

// ===== Submission confirmation =====
function makeSubmissionRef() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const rand = Math.floor(1000 + Math.random() * 9000) // 4 digits
  return `SR-${y}${m}${d}-${rand}`
}

router.post('/researcher/submit', (req, res) => {
  const data = (req.session && req.session.data) || {}
  data.submit ||= {}
  data.submit.submission ||= {}

  // store a simple submission record
  const ref = makeSubmissionRef()
  data.submit.submission.reference = ref
  data.submit.submission.submittedAt = new Date().toLocaleString('en-GB', { hour12: false })

  // mark a handy status flag for the task list, if you care to show it
  data.status ||= {}
  data.status['/researcher/submitted'] = 'completed'
  data.meta ||= {}
  data.meta.lastSaved = new Date().toLocaleString('en-GB', { hour12: false })

  // if your session store needs an explicit save, try it; otherwise just render
  if (typeof req.session.save === 'function') {
    return req.session.save(() => res.redirect('/researcher/submitted'))
  }
  return res.redirect('/researcher/submitted')
})

router.get('/researcher/submitted', (req, res) => {
  const data = (req.session && req.session.data) || {}
  res.render('researcher/submitted.html', {
    activeNav: 'create-request',
    data,
    submission: (data.submit && data.submit.submission) || {}
  })
})


module.exports = router
