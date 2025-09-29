// lib/derived.js
function get(obj, path, fallback) {
  try { return path.split('.').reduce((o, k) => (o || {})[k], obj) ?? fallback } catch { return fallback }
}

// Simple prototype model. Tune freely.
function calcMatchedEstimate(feasibility = {}, criteria = {}) {
  let base = Number(feasibility.totalEstimate || 0)
  if (!base || base < 0) base = 0
  let factor = 1

  const ageRange = get(criteria, 'ageRange', '18-65')
  if (ageRange === '18-65') factor *= 0.95
  else if (ageRange === '25-60') factor *= 0.9
  else if (ageRange === '30-55') factor *= 0.85
  else factor *= 0.85

  const diagnosisRequired = get(criteria, 'diagnosisRequired', 'no') === 'yes'
  if (diagnosisRequired) factor *= 0.7

  const travelMiles = Number(get(criteria, 'travelMiles', 10))
  if (travelMiles < 5) factor *= 0.65
  else if (travelMiles < 10) factor *= 0.75
  else if (travelMiles < 20) factor *= 0.85

  const availDays = Array.isArray(criteria.availabilityDays) ? criteria.availabilityDays.length : 0
  if (availDays <= 1) factor *= 0.7
  else if (availDays === 2) factor *= 0.8
  else if (availDays >= 3) factor *= 0.9

  const exclusions = Array.isArray(criteria.exclusions) ? criteria.exclusions.length : 0
  if (exclusions >= 3) factor *= 0.75
  else if (exclusions === 2) factor *= 0.85
  else if (exclusions === 1) factor *= 0.9

  const matched = Math.max(0, Math.round(base * factor))
  return { matched, factor }
}

function recomputeDerived(session) {
  const data = session.data || (session.data = {})
  const feasibility = data.feasibility || {}
  const criteria = data.criteria || {}
  const { matched } = calcMatchedEstimate(feasibility, criteria)
  data.derived = Object.assign({}, data.derived, { matchedEstimate: matched })
  return data.derived
}

module.exports = { calcMatchedEstimate, recomputeDerived, get }
