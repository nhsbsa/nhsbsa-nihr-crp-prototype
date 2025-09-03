const express = require('express')
const router = express.Router()

// Epic landing: Admin/Researcher sign up – lists all journeys
router.get('/epic/admin-researcher-signup', (req, res) => {
  res.render('epics/admin-researcher-signup')
})

module.exports = router
