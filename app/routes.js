// Master router: mount epic-specific routers
const express = require('express')
const router = express.Router()

router.use(require('./routes-auth'))   // Admin/Researcher sign-up epic
router.use(require('./routes-admin'))  // Admin: manage account requests epic
router.use(require('./routes-epics'))  // Epic landing pages

module.exports = router
