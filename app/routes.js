// app/routes.js
const express = require('express')
const path = require('path')
const router = express.Router()

function safeMount(relPath, label = relPath) {
  const abs = path.join(__dirname, relPath.replace(/^\.\//, ''))
  try {
    const mod = require(abs)
    if (typeof mod === 'function') {
      router.use(mod)
      console.log(`[routes] mounted: ${label}`)
    } else {
      console.warn(`[routes] skipped (not a function export): ${label}`)
    }
  } catch (err) {
    console.warn(`[routes] FAILED to mount: ${label}\n -> ${err.name}: ${err.message}`)
  }
}

safeMount('./home', 'home')
safeMount('./home-auto', 'home-auto')


// Hydrate Section B from feasibility/identify before anything renders
safeMount('./mw-hydrate-submit', 'mw-hydrate-submit')

// Public/epic
safeMount('./routes-auth', 'routes-auth')
safeMount('./routes-epics', 'routes-epics')

router.use(require('./mw-criteria-bridge'))
router.use(require('./researcher-preview'))

// Researcher scaffolding
safeMount('./researcher-nav-middleware', 'researcher-nav-middleware')
safeMount('./mw-last-saved', 'mw-last-saved')
safeMount('./researcher-progress-mapper', 'researcher-progress-mapper')

// Feature routers
safeMount('./researcher-entry', 'researcher-entry')
safeMount('./researcher-feasibility', 'researcher-feasibility')
safeMount('./researcher-identify-study', 'researcher-identify-study')
safeMount('./researcher-submit', 'researcher-submit')
safeMount('./researcher-volunteer-criteria', 'researcher-volunteer-criteria') // harmless if still around
safeMount('./routes-researcher', 'routes-researcher')

// Admin support (needs back-compat first)
safeMount('./mw-ethics-backcompat', 'mw-ethics-backcompat')
safeMount('./routes-admin', 'routes-admin')
safeMount('./routes-admin-studies', 'routes-admin-studies')

module.exports = router
