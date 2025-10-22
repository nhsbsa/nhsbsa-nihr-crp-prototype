// app/researcher-bpor.js
const express = require('express')
const router = express.Router()

function touchBPOR(req) {
  const data = req.session.data || (req.session.data = {})
  data.status = data.status || {}
  data.progress = data.progress || { sections: {} }
  data.meta = data.meta || {}
  data.bpor = data.bpor || {}
  data.bpor.matching = data.bpor.matching || {}
  // Mark this section as in-progress if first time
  if (!data.status['/researcher/bpor/matching']) {
    data.status['/researcher/bpor/matching'] = 'in-progress'
  }
}

// GET: BPOR matching criteria
router.get('/researcher/bpor/matching', (req, res) => {
  touchBPOR(req)
  const model = req.session.data.bpor.matching
  res.render('researcher/bpor/matching', {
    activeNav: 'create-request',
    model
  })
})

// POST: save BPOR matching criteria
router.post('/researcher/bpor/matching', (req, res) => {
  touchBPOR(req)

  const body = req.body || {}
  const existing = req.session.data.bpor.matching

  // Normalise arrays
  const toArray = v => Array.isArray(v) ? v : (v ? [v] : [])

  const payload = {
    ageMin: body.ageMin || '',
    ageMax: body.ageMax || '',
    ethnicity: toArray(body.ethnicity),
    locations: body.locations || '',
    sexAtBirth: toArray(body.sexAtBirth),
    researchAreas: toArray(body.researchAreas)
  }

  // store
  req.session.data.bpor.matching = { ...existing, ...payload }
  req.session.data.meta.lastSaved = new Date().toLocaleString('en-GB', { hour12: false })

  // ultra-basic completeness check
  const complete =
    payload.ageMin !== '' &&
    payload.ageMax !== '' &&
    payload.ethnicity.length > 0 &&
    payload.sexAtBirth.length > 0 &&
    payload.researchAreas.length > 0

  req.session.data.status['/researcher/bpor/matching'] = complete ? 'complete' : 'in-progress'

  // Send back to your researcher task list or wherever you want
  res.redirect('/researcher/task-list')
})

module.exports = router
