// app/researcher-identify-study.js
const express = require('express')
const router = express.Router()

function ensure(req) {
  const data = req.session.data || (req.session.data = {})
  data.study ||= {}
  data.study.identify ||= {}
  data.status ||= {}
  data.meta ||= {}
  return data
}
function stampSaved(data) {
  data.meta.lastSaved = new Date().toLocaleString('en-GB', { hour12: false })
}

// Tiny inline CPMS mock
const CPMS_FIXTURE = [
  { cpmsId: '123456', irasId: 'IRAS-8888', title: 'Diabetes Remission Trial', sponsor: 'NHS Trust A',
    laySummary: 'Testing lifestyle changes for type 2 diabetes.', sites: ['RBA','RDZ'] },
  { cpmsId: '654321', irasId: 'IRAS-7777', title: 'Cardio Better Hearts', sponsor: 'University B',
    laySummary: 'Evaluating a new home BP monitor.', sites: ['R1H','RQ6','RTK'] }
]
function findByCpms(id) {
  const s = String(id || '').trim()
  if (!s) return null
  return CPMS_FIXTURE.find(x => x.cpmsId === s) || null
}

router.get('/researcher/identify-study', (req, res) => {
  const data = ensure(req)
  const model = data.study.identify
  res.render('researcher/identify-study.html', {
    data,
    model,
    errors: [],
    result: null,
    activeNav: 'create-request'
  })
})

router.post('/researcher/identify-study', (req, res) => {
  const data = ensure(req)
  const b = req.body || {}
  const errors = []

  const cpmsId = (b.cpmsId || '').trim()
  const useManual = (b.useManual === 'yes')

  let result = null

  if (!useManual) {
    // CPMS path
    if (!cpmsId) errors.push({ href: '#cpmsId', text: 'Enter a CPMS ID or select “Enter details manually”.' })
    if (!errors.length) {
      result = findByCpms(cpmsId)
      if (!result) errors.push({ href: '#cpmsId', text: 'No study found for that CPMS ID.' })
    }
    if (errors.length) {
      return res.render('researcher/identify-study.html', {
        data, model: b, errors, result: null, activeNav: 'create-request'
      })
    }
    // Prefill identify block
    data.study.identify = {
      cpmsId: result.cpmsId,
      irasId: result.irasId,
      title: result.title,
      laySummary: result.laySummary,
      sponsor: result.sponsor,
      sites: result.sites
    }
  } else {
    // Manual path
    const title = (b.title || '').trim()
    const laySummary = (b.laySummary || '').trim()
    if (!title) errors.push({ href: '#title', text: 'Enter a study title' })
    if (!laySummary) errors.push({ href: '#laySummary', text: 'Enter a lay summary' })
    if (errors.length) {
      return res.render('researcher/identify-study.html', {
        data, model: b, errors, result: null, activeNav: 'create-request'
      })
    }
    data.study.identify = {
      cpmsId: cpmsId || '',
      irasId: (b.irasId || '').trim(),
      title,
      laySummary,
      sponsor: (b.sponsor || '').trim(),
      sites: []
    }
  }

  // Mark step done and save
  data.status['/researcher/identify-study'] = 'completed'
  stampSaved(data)

  // Show confirmation inline
  res.render('researcher/identify-study.html', {
    data,
    model: data.study.identify,
    errors: [],
    result: data.study.identify,
    activeNav: 'create-request'
  })
})

module.exports = router
