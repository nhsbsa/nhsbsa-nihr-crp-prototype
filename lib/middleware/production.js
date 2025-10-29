/**
 * Production middleware: security headers + safe HTTPS enforcement
 * Prototype-only. Review before any real deployment.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function production(req, res, next) {
  // Security headers
  res.setHeader(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  )
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'no-referrer-when-downgrade')
  // Keep CSP upgrade if you want it
  res.setHeader('Content-Security-Policy', 'upgrade-insecure-requests')

  // Respect Heroku/other proxies when checking protocol
  const proto = (req.get('x-forwarded-proto') || req.protocol || '').toLowerCase()

  if (proto !== 'https') {
    const host = req.get('host') || ''
    const path = req.originalUrl || req.url || '/'
    return res.redirect(302, `https://${host}${path}`)
  }

  return next()
}

module.exports = production
