// app/lib/cpms.js
function normalize(id) {
  if (!id) return ''
  const raw = String(id).trim().toUpperCase()
  const cleaned = raw.replace(/[\s-]+/g, '')
  // Accept: CPMS123456, CPMS-123456, CPMS 123456, 123456
  const m = cleaned.match(/^CPMS?(\d{4,})$/) || cleaned.match(/^(\d{4,})$/)
  if (m) return 'CPMS' + (m[1] || m[0])
  if (/^CPMS\d{4,}$/.test(cleaned)) return cleaned
  return ''
}

function getById(id) {
  const key = normalize(id)
  if (!key) return null

  // Tiny demo DB
  const db = {
    'CPMS123456': {
      cpmsId: 'CPMS123456',
      irasId: 'IRAS-21/NE/0001',
      title: 'Randomised evaluation of Widgetumab in adults with Condition X',
      laySummary: 'Evaluates whether Widgetumab improves daily functioning for adults with Condition X.'
    },
    'CPMS654321': {
      cpmsId: 'CPMS654321',
      irasId: 'IRAS-22/LON/0007',
      title: 'Observational registry of sleep patterns after remote working',
      laySummary: 'Observes sleep patterns of adults working remotely to understand lifestyle effects.'
    }
  }

  // If not in demo DB, return placeholder so the prototype still flows
  return db[key] || {
    cpmsId: key,
    irasId: '',
    title: `Study ${key}`,
    laySummary: 'Summary to be confirmed. Populate from CPMS or edit manually.'
  }
}

module.exports = { getById, normalize }
