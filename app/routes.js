// app/routes.js
const express = require('express')
const path = require('path')
const router = express.Router()

/**
 * Mount a child router or middleware exported from a local file.
 * Accepts either an Express router (function) or a plain middleware function.
 */
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
    console.warn(`[routes] mount failed: ${label} -> ${err && err.message}`)
  }
}

/* ---------------- Core pages ---------------- */
safeMount('./home', 'home')
safeMount('./home-auto', 'home-auto')
safeMount('./routes-auth', 'routes-auth')

/* ---------------- Researcher: legacy bits kept safe ---------------- */
safeMount('./mw-criteria-bridge', 'mw-criteria-bridge')

// Older feature files retained for compatibility if present
try { router.use(require('./researcher-bpor')) ; console.log('[routes] mounted: researcher-bpor') } catch (e) { /* optional */ }
try { router.use(require('./researcher-preview')) ; console.log('[routes] mounted: researcher-preview') } catch (e) { /* optional */ }
try { router.use(require('./researcher-study-sites')) ; console.log('[routes] mounted: researcher-study-sites') } catch (e) { /* optional */ }

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

// NEW: catch orphaned placeholder POSTs
safeMount('./routes-researcher-orphans', 'routes-researcher-orphans')

/* ---------------- Admin: mount new flow FIRST so it wins /admin ----------------
   If legacy routers also register GET /admin, they would steal the route if mounted first.
   Order here ensures our dashboard/overview/review are the handlers users see. */
safeMount('./admin-eligibility', 'admin-eligibility')

// Legacy admin routers (mounted AFTER to avoid shadowing)
safeMount('./mw-ethics-backcompat', 'mw-ethics-backcompat')
safeMount('./routes-admin', 'routes-admin')
safeMount('./routes-admin-studies', 'routes-admin-studies')

/* ---------------- Admin: NEW review workspace ---------------- */
safeMount('./routes-admin-review', 'routes-admin-review')

/* ---------------- Convenience: home redirect if nothing else claimed '/' ---------------- */
router.get('/', (req, res, next) => {
  // If something already wrote a response, skip
  if (res.headersSent) return next()
  // Gentle nudge to admin dashboard for this prototype
  return res.redirect('/admin')
})


// Mount prescreener journey
require('./routes-prescreener')(router);

safeMount('./routes-data', 'routes-data')

module.exports = router
