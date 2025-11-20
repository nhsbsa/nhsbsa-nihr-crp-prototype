// app/researcher-entry.js
const express = require('express')
const router = express.Router()

function touchIntro(req) {
  const data = req.session.data || (req.session.data = {})
  data.status = data.status || {}
  if (!data.status['/researcher/feasibility/intro']) {
    data.status['/researcher/feasibility/intro'] = 'in-progress'
  }
  data.progress = data.progress || { sections: {} }
  data.meta = data.meta || {}
  data.submit = data.submit || {}
}

// Canonical start page
router.get('/researcher/request/new', (req, res) => {
  touchIntro(req)
  res.render('researcher/start-request', {
    activeNav: 'create-request',
    model: req.session.data.submit
  })
})

// Start Now -> capture platform then branch
const jdrFirstStep = '/researcher/feasibility/demographics'       // your JDR first step
const bporFirstStep = '/researcher/bpor/matching'                  // BPOR matching page

router.post('/researcher/request/new', (req, res) => {
  touchIntro(req)

  // capture platform from radios on start page
  const platform = (req.body && req.body.platform) || req.session.data.submit.platform || 'JDR'
  req.session.data.submit.platform = platform

  // mark platform step complete in status (so your task list shows progress)
  req.session.data.status['/researcher/feasibility/platform'] = 'completed'

  // timestamp
  req.session.data.meta.lastSaved = new Date().toLocaleString('en-GB', { hour12: false })

  // branch
  res.redirect(platform === 'BPOR' ? bporFirstStep : jdrFirstStep)
})

// Back-compat
router.get('/researcher/feasibility/intro', (req, res) => {
  touchIntro(req)
  res.redirect(301, '/researcher/request/new')
})

module.exports = router
