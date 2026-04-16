/**
 * Client-side profile completion calculator.
 * Must stay in sync with server/utils/profileCompletion.js
 */
export function calcCompletion(role, p) {
  if (!p) return 20
  if (role === 'freelancer') {
    let pct = 20
    if (p.bio) pct += 20
    if (p.skills && p.skills.length > 0) pct += 20
    if (p.githubUrl) pct += 15
    if (p.linkedinUrl) pct += 5
    if (p.portfolioUrl) pct += 5
    if (p.projectSamples && p.projectSamples.length > 0) pct += 10
    if (p.resumeUrl) pct += 5
    return Math.min(100, pct)
  } else {
    if (p.clientType === 'individual') {
      let pct = 20
      if (p.bio) pct += 15
      if (p.avatarUrl) pct += 15
      if (p.location) pct += 15
      if (p.yearsHiring) pct += 15
      if (p.linkedinUrl) pct += 10
      if (p.preferredComm) pct += 10
      if (p.paymentVerified) pct += 10
      return Math.min(100, pct)
    } else if (p.clientType === 'business') {
      let pct = 5
      if (p.bio) pct += 10
      if (p.avatarUrl) pct += 10
      if (p.location) pct += 10
      if (p.yearsHiring) pct += 10
      if (p.companyName) pct += 10
      if (p.industry) pct += 10
      if (p.companySize) pct += 10
      if (p.websiteUrl) pct += 5
      if (p.linkedinUrl) pct += 5
      if (p.preferredComm) pct += 5
      if (p.paymentVerified) pct += 10
      return Math.min(100, pct)
    } else {
      let pct = 20
      if (p.bio) pct += 10
      return Math.min(30, pct)
    }
  }
}
