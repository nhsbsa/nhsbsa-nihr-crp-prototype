// app/mw-last-saved.js
const express = require('express')
const router = express.Router()

router.post(/\/researcher\/.*/, (req, res, next) => {
  const data = req.session.data || (req.session.data = {})
  data.meta = data.meta || {}
  data.meta.lastSaved = new Date().toLocaleString('en-GB', { hour12: false })
  next()
})

module.exports = router
