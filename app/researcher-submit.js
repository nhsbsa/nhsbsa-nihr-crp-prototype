// app/researcher-submit.js
const express = require('express')
const router = express.Router()

// Optional multer: don’t crash if not installed
let uploadSingle = (field) => (req, res, next) => { req.file = undefined; next() }
try {
  const multer = require('multer')
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })
  uploadSingle = (field) => upload.single(field)
} catch (e) {
  console.warn('[submit] multer not installed, file uploads disabled (ethics still accepts ref+date).')
}

function ensure(req) {
  const data = req.session.data || (req.session.data = {})
  data.submit ||= {}
  data.status ||= {}
  data.meta ||= {}
  return data
}
function stampSaved(data) {
  data.meta.lastSaved = new Date().toLocaleString('en-GB', { hour12: false })
}

// Non-destructive hydration (kept brief)
function hydrate(data) {
  const F = data.feasibility || {}
  const S = data.submit ||= {}
  const FeasDemo = F.demographics || F.cohort || F.filters || {}
  const FeasMed  = F.medical || F.conditions || {}
  const FeasSites = (F.sites && (F.sites.siteCodes || F.sites.codes)) || F.siteCodes || F.sites || []

  S.studyInfo ||= (data.study && data.study.identify) ? {
    title: data.study.identify.title || '',
    laySummary: data.study.identify.laySummary || '',
    cpmsId: data.study.identify.cpmsId || '',
    irasId: data.study.identify.irasId || ''
  } : S.studyInfo

  S.demographics ||= {}
  const D = S.demographics
  if (!D.sex && (FeasDemo.sex || FeasDemo.gender)) D.sex = FeasDemo.sex || FeasDemo.gender
  if (!D.ageMode) D.ageMode = (FeasDemo.ageMode || (FeasDemo.ageMin || FeasDemo.ageMax ? 'custom' : 'any') || 'any')
  if (!D.ageMin && FeasDemo.ageMin) D.ageMin = FeasDemo.ageMin
  if (!D.ageMax && FeasDemo.ageMax) D.ageMax = FeasDemo.ageMax
  if ((!Array.isArray(D.regions) || !D.regions.length) && (FeasDemo.regions || FeasDemo.region)) {
    const reg = FeasDemo.regions || FeasDemo.region
    D.regions = Array.isArray(reg) ? reg : [reg]
  }
  D.sex ||= 'any'; D.ageMode ||= 'any'; D.regions ||= []

  S.medical ||= {}
  const M = S.medical
  if (!M.conditions && (FeasMed.conditions || FeasMed.interests)) M.conditions = FeasMed.conditions || FeasMed.interests
  if (!M.requiresConfirmed && (FeasMed.requiresConfirmed || FeasMed.confirmed)) {
    M.requiresConfirmed = (FeasMed.requiresConfirmed || FeasMed.confirmed) === 'yes' ? 'yes' : 'no'
  }
  M.requiresConfirmed ||= 'no'

  const haveNested = S.sites && Array.isArray(S.sites.siteCodes) && S.sites.siteCodes.length
  const haveFlat = Array.isArray(S.siteCodes) && S.siteCodes.length
  if (!haveNested && !haveFlat && FeasSites && (Array.isArray(FeasSites) ? FeasSites.length : true)) {
    const codes = (Array.isArray(FeasSites) ? FeasSites : [FeasSites]).map(s => String(s).trim().toUpperCase()).filter(Boolean)
    if (codes.length) { S.sites = { siteCodes: codes }; S.siteCodes = codes }
  } else if (haveNested && !haveFlat) {
    S.siteCodes = S.sites.siteCodes.slice()
  } else if (!haveNested && haveFlat) {
    S.sites = { siteCodes: S.siteCodes.slice() }
  }

  S.studyType ||= { category: '' }
}

/* ---------------------- Study information ---------------------- */
router.get('/researcher/study-info', (req, res) => {
  const data = ensure(req); hydrate(data)
  res.render('researcher/study-info.html', { data, model: data.submit.studyInfo || {}, errors: [], activeNav: 'create-request' })
})
router.post('/researcher/study-info', (req, res) => {
  const data = ensure(req)
  const b = req.body || {}
  const errors = []
  const title = (b.title || '').trim()
  const laySummary = (b.laySummary || '').trim()
  if (!title) errors.push({ href: '#title', text: 'Enter a study title' })
  if (!laySummary) errors.push({ href: '#laySummary', text: 'Enter a lay summary' })
  if (errors.length) return res.render('researcher/study-info.html', { data, model: b, errors, activeNav: 'create-request' })
  data.submit.studyInfo = { title, laySummary, cpmsId: (b.cpmsId || '').trim(), irasId: (b.irasId || '').trim() }
  data.status['/researcher/study-info'] = 'completed'; stampSaved(data); res.redirect('/researcher/task-list')
})

/* ---------------------- Study type ---------------------- */
router.get('/researcher/study-type', (req, res) => {
  const data = ensure(req); hydrate(data)
  res.render('researcher/study-type.html', { data, model: data.submit.studyType || {}, errors: [], activeNav: 'create-request' })
})
router.post('/researcher/study-type', (req, res) => {
  const data = ensure(req)
  const b = req.body || {}
  const errors = []
  const category = (b.category || '').trim()
  if (!category) errors.push({ href: '#category', text: 'Select a study type' })
  if (errors.length) return res.render('researcher/study-type.html', { data, model: b, errors, activeNav: 'create-request' })
  data.submit.studyType = { category, notes: (b.notes || '').trim() }
  data.status['/researcher/study-type'] = 'completed'; stampSaved(data); res.redirect('/researcher/task-list')
})

/* ---------------------- Demographics ---------------------- */
router.get('/researcher/demographics', (req, res) => {
  const data = ensure(req); hydrate(data)
  res.render('researcher/demographics.html', { data, model: data.submit.demographics || {}, errors: [], activeNav: 'create-request' })
})
router.post('/researcher/demographics', (req, res) => {
  const data = ensure(req)
  const b = req.body || {}
  const errors = []
  const ageMode = b.ageMode || 'any'
  if (ageMode === 'custom') {
    const min = parseInt(b.ageMin || '', 10)
    const max = parseInt(b.ageMax || '', 10)
    if (Number.isNaN(min)) errors.push({ href: '#ageMin', text: 'Enter a minimum age' })
    if (Number.isNaN(max)) errors.push({ href: '#ageMax', text: 'Enter a maximum age' })
    if (!Number.isNaN(min) && !Number.isNaN(max) && min > max) errors.push({ href: '#ageMin', text: 'Minimum age must be less than maximum age' })
  }
  if (errors.length) return res.render('researcher/demographics.html', { data, model: b, errors, activeNav: 'create-request' })
  data.submit.demographics = {
    sex: b.sex || 'any',
    ageMode,
    ageMin: b.ageMin || '',
    ageMax: b.ageMax || '',
    regions: Array.isArray(b.regions) ? b.regions : (b.regions ? [b.regions] : [])
  }
  data.status['/researcher/demographics'] = 'completed'; stampSaved(data); res.redirect('/researcher/task-list')
})

/* ---------------------- Medical ---------------------- */
router.get('/researcher/medical', (req, res) => {
  const data = ensure(req); hydrate(data)
  res.render('researcher/medical.html', { data, model: data.submit.medical || {}, errors: [], activeNav: 'create-request' })
})
router.post('/researcher/medical', (req, res) => {
  const data = ensure(req)
  const b = req.body || {}
  const errors = []
  const conditions = (b.conditions || '').trim()
  if (!conditions) errors.push({ href: '#conditions', text: 'Enter one or more conditions or interests' })
  const requiresConfirmed = b.requiresConfirmed === 'yes' ? 'yes' : 'no'
  if (errors.length) return res.render('researcher/medical.html', { data, model: b, errors, activeNav: 'create-request' })
  data.submit.medical = { conditions, requiresConfirmed }
  data.status['/researcher/medical'] = 'completed'; stampSaved(data); res.redirect('/researcher/task-list')
})

/* ---------------------- Sites ---------------------- */
router.get('/researcher/sites', (req, res) => {
  const data = ensure(req); hydrate(data)
  res.render('researcher/sites.html', { data, model: data.submit.sites || {}, errors: [], activeNav: 'create-request' })
})
router.post('/researcher/sites', (req, res) => {
  const data = ensure(req)
  const b = req.body || {}
  const errors = []
  const codesRaw = (b.siteCodes || '').trim()
  if (!codesRaw) errors.push({ href: '#siteCodes', text: 'Enter at least one site code' })
  const codes = codesRaw ? Array.from(new Set(codesRaw.split(/[\s,]+/).filter(Boolean).map(s => s.toUpperCase()))) : []
  if (errors.length) return res.render('researcher/sites.html', { data, model: b, errors, activeNav: 'create-request' })
  data.submit.sites = { siteCodes: codes }
  data.submit.siteCodes = codes
  data.status['/researcher/sites'] = 'completed'; stampSaved(data); res.redirect('/researcher/task-list')
})

/* ---------------------- Ethics (dropdown + optional upload) ---------------------- */
router.get('/researcher/ethics', (req, res) => {
  const data = ensure(req)
  // ensure defaults for toggles so the template behaves on first load
  const model = Object.assign({ hasApproval: '', proofMethod: 'ref' }, data.submit.ethics || {})
  res.render('researcher/ethics.html', { data, model, errors: [], activeNav: 'create-request' })
})
router.post('/researcher/ethics', uploadSingle('approvalFile'), (req, res) => {
  const data = ensure(req)
  const b = req.body || {}
  const file = req.file // undefined if no multer
  const errors = []

  const hasApproval = b.hasApproval === 'yes' ? 'yes' : (b.hasApproval === 'no' ? 'no' : '')
  if (!hasApproval) {
    errors.push({ href: '#hasApproval-yes', text: 'Select whether you have ethics approval' })
  }

  if (hasApproval === 'yes') {
    const proofMethod = (b.proofMethod === 'upload') ? 'upload' : 'ref'
    const reference = (b.reference || '').trim()
    const approvalDate = (b.approvalDate || '').trim()
    const hasRefAndDate = !!(reference && approvalDate)
    const hasUpload = !!file

    // Require the chosen method; allow both if they provided both
    if (proofMethod === 'ref' && !hasRefAndDate && !hasUpload) {
      errors.push({ href: '#reference', text: 'Provide a REC reference and approval date or switch to Upload approval letter' })
    }
    if (proofMethod === 'upload' && !hasUpload && !hasRefAndDate) {
      errors.push({ href: '#approvalFile', text: 'Upload the approval letter or switch to REC reference + date' })
    }
    if (approvalDate && !/^\d{4}-\d{2}-\d{2}$/.test(approvalDate)) {
      errors.push({ href: '#approvalDate', text: 'Enter approval date in the format YYYY-MM-DD' })
    }

    if (errors.length) {
      const model = Object.assign({}, b)
      if (data.submit.ethics && data.submit.ethics.file) model.file = data.submit.ethics.file
      model.proofMethod = proofMethod
      return res.render('researcher/ethics.html', { data, model, errors, activeNav: 'create-request' })
    }

    data.submit.ethics = {
      hasApproval: 'yes',
      proofMethod,
      reference,
      approvalDate,
      expectedDate: '',
      notes: (b.notes || '').trim()
    }

    if (file) {
      data.submit.ethics.file = {
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        uploadedAt: new Date().toISOString()
      }
    }

    data.submit.ethics.fileUploaded = !!(data.submit.ethics.file && data.submit.ethics.file.originalname)

  } else if (hasApproval === 'no') {
    const expectedDate = (b.expectedDate || '').trim()
    if (expectedDate && !/^\d{4}-\d{2}-\d{2}$/.test(expectedDate)) {
      errors.push({ href: '#expectedDate', text: 'Enter expected approval date in the format YYYY-MM-DD' })
    }
    if (errors.length) {
      return res.render('researcher/ethics.html', { data, model: b, errors, activeNav: 'create-request' })
    }
    data.submit.ethics = {
      hasApproval: 'no',
      proofMethod: '',
      reference: '',
      approvalDate: '',
      expectedDate,
      notes: (b.notes || '').trim(),
      file: data.submit.ethics && data.submit.ethics.file ? data.submit.ethics.file : undefined,
      fileUploaded: !!(data.submit.ethics && data.submit.ethics.file && data.submit.ethics.file.originalname)
    }
  }

  data.status['/researcher/ethics'] = 'completed'
  stampSaved(data)
  res.redirect('/researcher/task-list')
})

/* ---------------------- Target date ---------------------- */
router.get('/researcher/target-date', (req, res) => {
  const data = ensure(req); hydrate(data)
  res.render('researcher/target-date.html', { data, model: data.submit.targetDate || {}, errors: [], activeNav: 'create-request' })
})
router.post('/researcher/target-date', (req, res) => {
  const data = ensure(req)
  const b = req.body || {}
  const errors = []
  const target = (b.targetDate || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(target)) errors.push({ href: '#targetDate', text: 'Enter a target date in the format YYYY-MM-DD' })
  if (errors.length) return res.render('researcher/target-date.html', { data, model: b, errors, activeNav: 'create-request' })
  data.submit.targetDate = { targetDate: target }
  data.status['/researcher/target-date'] = 'completed'; stampSaved(data); res.redirect('/researcher/task-list')
})

module.exports = router
