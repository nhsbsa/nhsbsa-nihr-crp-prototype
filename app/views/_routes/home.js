// app/home.js
const express = require('express')
const router = express.Router()

router.get('/', (req, res) => {
  res.render('index.html', {
    featuredId: 'submit-study'   // Force the “Researcher: Submit a new study” epic
  })
})

module.exports = router
