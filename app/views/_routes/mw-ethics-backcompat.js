// app/mw-ethics-backcompat.js
const express = require('express')
const router = express.Router()

/**
 * Back-compat shim for admin routes that still read:
 *   data.submit.hasEthics
 *
 * New structure (from researcher-submit):
 *   data.submit.ethics = {
 *     hasApproval: 'yes' | 'no',
 *     reference?: string,
 *     approvalDate?: 'YYYY-MM-DD',
 *     expectedDate?: 'YYYY-MM-DD',
 *     notes?: string,
 *     file?: { originalname, mimetype, size, uploadedAt }
 *   }
 *
 * This middleware derives:
 *   data.submit.hasEthics: boolean (true if approval proven or explicitly 'yes')
 *   data.submit.ethicsStatus: 'has-approval' | 'awaiting' | 'unknown'
 */
router.use((req, res, next) => {
  const data = req.session?.data || (req.session.data = {})
  data.submit ||= {}

  const e = data.submit.ethics || {}

  const hasApprovalYes = e.hasApproval === 'yes'
  const hasRefAndDate = !!(e.reference && e.approvalDate)
  const hasFile = !!(e.file && e.file.originalname)

  // If user said "yes", treat as true once either ref+date or file exists.
  // If user said "no", it's false for now (awaiting approval).
  // If unknown, keep false and mark 'unknown'.
  let hasEthics = false
  let ethicsStatus = 'unknown'

  if (hasApprovalYes) {
    hasEthics = hasRefAndDate || hasFile
    ethicsStatus = hasEthics ? 'has-approval' : 'unknown'
  } else if (e.hasApproval === 'no') {
    hasEthics = false
    ethicsStatus = 'awaiting'
  } else {
    hasEthics = false
    ethicsStatus = 'unknown'
  }

  // Back-compat flags for admin code
  data.submit.hasEthics = hasEthics
  data.submit.ethicsStatus = ethicsStatus

  // Handy locals for templates (non-breaking)
  res.locals.ethics = {
    hasEthics,
    ethicsStatus,
    reference: e.reference || '',
    approvalDate: e.approvalDate || '',
    expectedDate: e.expectedDate || '',
    file: e.file || null
  }

  next()
})

module.exports = router
