/**
 * Calculates profile completion percentage from the portfolio document.
 * Keep this in sync with the client-side calcCompletion in ProfileSetup.jsx.
 *
 * Individual client (100%):
 *   base(20) + bio(15) + avatarUrl(15) + location(15) + yearsHiring(15) + linkedinUrl(10) + preferredComm(10)
 *
 * Business client (100%):
 *   base(5) + bio(10) + avatarUrl(10) + location(10) + yearsHiring(10) +
 *   companyName(10) + industry(10) + companySize(10) + websiteUrl(5) +
 *   linkedinUrl(5) + preferredComm(5) + paymentVerified(10)
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
    if (data.clientType === 'individual') {
      let pct = 20
      if (data.bio) pct += 15
      if (data.avatarUrl) pct += 15
      if (data.location) pct += 15
      if (data.yearsHiring) pct += 15
      if (data.linkedinUrl) pct += 10
      if (data.preferredComm) pct += 10
      if (data.paymentVerified) pct += 10
      return Math.min(100, pct)
    } else if (data.clientType === 'business') {
      let pct = 5
      if (data.bio) pct += 10
      if (data.avatarUrl) pct += 10
      if (data.location) pct += 10
      if (data.yearsHiring) pct += 10
      if (data.companyName) pct += 10
      if (data.industry) pct += 10
      if (data.companySize) pct += 10
      if (data.websiteUrl) pct += 5
      if (data.linkedinUrl) pct += 5
      if (data.preferredComm) pct += 5
      if (data.paymentVerified) pct += 10
      return Math.min(100, pct)
    } else {
      // clientType not yet chosen — show minimal base
      let pct = 20
      if (data.bio) pct += 10
      return Math.min(30, pct)
    }
  }
}

module.exports = { calcCompletion }
