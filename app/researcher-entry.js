// app/researcher-entry.js
const express = require('express')
const router = express.Router()

function ensure(req) {
  const data = req.session.data || (req.session.data = {})
  data.submission ||= {}
  return data
}

// Start page for the "Create study request" journey
router.get('/researcher/request/new', (req, res) => {
  const data = ensure(req)
  // Seed a draft so downstream routes can rely on it
  data.submission = Object.assign({}, data.submission, { status: 'draft' })
  return res.render('researcher/start-request.html', {
    data,
    activeNav: 'create-request'
  })
})

// Button submits here and then we move into Feasibility intro
router.post('/researcher/request/new', (req, res) => {
  const data = ensure(req)
  data.submission = Object.assign({}, data.submission, { status: 'draft' })
  return res.redirect('/researcher/feasibility/intro')
})

module.exports = router
