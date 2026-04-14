/**
 * Calculates profile completion percentage from the portfolio document.
 * Keep this in sync with the client-side calcCompletion in ProfileSetup.jsx.
 */
function calcCompletion(role, data) {
  if (role === 'freelancer') {
    let pct = 20
    if (data.bio) pct += 15
    if (data.skills && data.skills.length > 0) pct += 15
    if (data.hourlyRate) pct += 10
    if (data.githubUrl) pct += 10
    if (data.linkedinUrl) pct += 5
    if (data.portfolioUrl) pct += 5
    if (data.projectSamples && data.projectSamples.length > 0) pct += 10
    if (data.resumeUrl) pct += 10
    return Math.min(100, pct)
  } else {
    // Client: 4 user-fillable fields × 20% each + 20% base = 100%
    // paymentVerified is system-set so excluded from completion
    let pct = 20
    if (data.bio) pct += 20
    if (data.companyName) pct += 20
    if (data.industry) pct += 20
    if (data.linkedinUrl) pct += 20
    return Math.min(100, pct)
  }
}

module.exports = { calcCompletion }
