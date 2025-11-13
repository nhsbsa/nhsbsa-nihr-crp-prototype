// app/routes-data.js
const express = require('express')
const path = require('path')

const router = express.Router()

// Prototype-only: serve JSON lists from app/data
router.get('/data/conditions.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'data', 'conditions.json'))
})

module.exports = router
