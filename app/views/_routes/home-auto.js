// app/home-auto.js
const express = require('express')
const { join, relative, sep } = require('path')
const { readdirSync, statSync, existsSync } = require('fs')

const router = express.Router()
const TOPS = ['researcher', 'admin', 'epics', 'prototypes', 'docs', 'auth', 'one-login']

function isSkippable(full) {
  const parts = full.split(sep)
  const name = parts[parts.length - 1]
  if (name.startsWith('_')) return true
  if (name.includes('layout')) return true
  if (parts.includes('includes') || parts.includes('partials') || parts.includes('macros')) return true
  if (parts.includes('__MACOSX')) return true
  return false
}
function toUrl(viewRoot, fpath) {
  const rel = relative(viewRoot, fpath).replace(/\\/g, '/')
  let url = '/' + rel.replace(/\.html?$/i, '')
  if (url.endsWith('/index')) url = url.slice(0, -('/index'.length))
  return url
}
function safeWalk(dir, out) {
  const entries = readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) { safeWalk(full, out); continue }
    if (!/\.html?$/i.test(entry.name)) continue
    if (isSkippable(full)) continue
    const stat = statSync(full)
    const url = toUrl(dirRoot, full)   // dirRoot is set in scanViews
    const top = relative(dirRoot, full).split(sep)[0] || 'other'
    out.push({ file: full, url, top, mtime: stat.mtimeMs })
  }
}
let dirRoot = '' // global for toUrl/safeWalk

function scanViews(viewRoot) {
  const out = []
  dirRoot = viewRoot
  safeWalk(viewRoot, out)
  return out
}
function pickFeatured(pages) {
  const prefers = [
    '/researcher/request/new',
    '/researcher/feasibility/intro',
    '/researcher/task-list',
    '/researcher'
  ]
  for (const u of prefers) {
    const hit = pages.find(p => p.url === u)
    if (hit) return hit
  }
  const res = pages.filter(p => p.top === 'researcher').sort((a,b)=>b.mtime-a.mtime)[0]
  if (res) return res
  const adm = pages.filter(p => p.top === 'admin').sort((a,b)=>b.mtime-a.mtime)[0]
  if (adm) return adm
  return pages.slice().sort((a,b)=>b.mtime-a.mtime)[0] || null
}

router.get('/home/auto', (req, res) => {
  // 1) Prefer the real folder under app/, because Express.get('views') is the default ./views
  let viewRoot = join(__dirname, 'views') // __dirname is .../app
  // 2) If someone actually configured a valid views dir that exists, use it
  const configured = req.app.get('views')
  if (Array.isArray(configured)) {
    const match = configured.find(p => String(p).endsWith(`${sep}app${sep}views`) || String(p).includes(`${sep}app${sep}views`))
    if (match && existsSync(match)) viewRoot = match
  } else if (typeof configured === 'string' && existsSync(configured)) {
    viewRoot = configured
  }
  if (!existsSync(viewRoot)) {
    // Last resort. If this hits, your project tree is cursed.
    return res.status(500).send(`Auto-home: cannot find views directory. Tried ${viewRoot}`)
  }

  let pages = []
  try {
    pages = scanViews(viewRoot)
  } catch (e) {
    return res.status(500).send(`Auto-home: failed to scan ${viewRoot}: ${e.message}`)
  }

  const buckets = {}
  for (const p of pages) {
    const key = TOPS.includes(p.top) ? p.top : 'other'
    ;(buckets[key] ||= []).push(p)
  }
  for (const k of Object.keys(buckets)) {
    buckets[k].sort((a,b)=>a.url.localeCompare(b.url))
  }

  const featured = pickFeatured(pages)
  res.render('home-auto.html', {
    featured,
    buckets,
    updatedAt: new Date().toISOString()
  })
})

module.exports = router
