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

// Home e.g. /
// safeMount('./home', 'home')
router.get('/', (req, res) => {
  res.render('index.html', {
    featuredId: 'submit-study'   // Force the “Researcher: Submit a new study” epic
  })
})

// safeMount('./home-auto', 'home-auto') // Not sure this route is used?

safeMount('./views/_routes/routes-auth', 'routes-auth')

/* ---------------- Researcher: legacy bits kept safe ---------------- */
safeMount('./views/_routes/mw-criteria-bridge', 'mw-criteria-bridge')

// Older feature files retained for compatibility if present
try { router.use(require('./views/_routes/researcher-bpor')) ; console.log('[routes] mounted: researcher-bpor') } catch (e) { /* optional */ }
try { router.use(require('./views/_routes/researcher-preview')) ; console.log('[routes] mounted: researcher-preview') } catch (e) { /* optional */ }
try { router.use(require('./views/_routes/researcher-study-sites')) ; console.log('[routes] mounted: researcher-study-sites') } catch (e) { /* optional */ }

// Researcher scaffolding
safeMount('./views/_routes/researcher-nav-middleware', 'researcher-nav-middleware')
safeMount('./views/_routes/mw-last-saved', 'mw-last-saved')
// safeMount('./views/_routes/researcher-progress-mapper', 'researcher-progress-mapper')

// Feature routers
safeMount('./views/_routes/researcher-entry', 'researcher-entry')
safeMount('./views/_routes/researcher-feasibility', 'researcher-feasibility')
safeMount('./views/_routes/researcher-identify-study', 'researcher-identify-study')
safeMount('./views/_routes/researcher-submit', 'researcher-submit')
safeMount('./views/_routes/researcher-volunteer-criteria', 'researcher-volunteer-criteria') // harmless if still around
safeMount('./views/_routes/routes-researcher', 'routes-researcher')

// NEW: catch orphaned placeholder POSTs
safeMount('./views/_routes/routes-researcher-orphans', 'routes-researcher-orphans')

/* ---------------- Admin: mount new flow FIRST so it wins /admin ----------------
   If legacy routers also register GET /admin, they would steal the route if mounted first.
   Order here ensures our dashboard/overview/review are the handlers users see. */
safeMount('./views/_routes/admin-eligibility', 'admin-eligibility')

// Legacy admin routers (mounted AFTER to avoid shadowing)
safeMount('./views/_routes/mw-ethics-backcompat', 'mw-ethics-backcompat')
safeMount('./views/_routes/routes-admin', 'routes-admin')
safeMount('./views/_routes/routes-admin-studies', 'routes-admin-studies')

/* ---------------- Admin: NEW review workspace ---------------- */
// safeMount('./views/_routes/routes-admin-review', 'routes-admin-review')

/* ---------------- Convenience: home redirect if nothing else claimed '/' ---------------- */
router.get('/', (req, res, next) => {
  // If something already wrote a response, skip
  if (res.headersSent) return next()
  // Gentle nudge to admin dashboard for this prototype
  return res.redirect('/admin')
})


// Mount prescreener journey
require('./views/_routes/routes-prescreener')(router);

safeMount('./views/_routes/routes-data', 'routes-data')

module.exports = router
