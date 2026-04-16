// Shared badge definitions used by ProfileSetup (own profile) and
// FreelancerProfile (public profile view).
//
// condition(user, portfolio) → boolean
//   user      = full User doc (has rating, totalJobsCompleted, onTimeDeliveryRate, disputeRate)
//   portfolio = Portfolio doc

export const FREELANCER_BADGES = [
  {
    id: 'top_rated',
    icon: '🏆',
    title: 'Top Rated',
    description: 'Rating ≥ 4.5 with 5+ completed jobs',
    condition: (u) => (u?.rating || 0) >= 4.5 && (u?.totalJobsCompleted || 0) >= 5,
    color: 'amber',
  },
  {
    id: 'rising_star',
    icon: '⭐',
    title: 'Rising Star',
    description: 'Complete 1+ job with rating ≥ 4.0',
    condition: (u) => (u?.rating || 0) >= 4.0 && (u?.totalJobsCompleted || 0) >= 1,
    color: 'amber',
  },
  {
    id: 'on_time',
    icon: '⏱️',
    title: 'On-Time Pro',
    description: '90%+ on-time delivery over 3+ jobs',
    condition: (u) => (u?.onTimeDeliveryRate || 0) >= 90 && (u?.totalJobsCompleted || 0) >= 3,
    color: 'blue',
  },
  {
    id: 'dispute_free',
    icon: '🛡️',
    title: 'Dispute-Free',
    description: 'Zero disputes across 3+ completed jobs',
    condition: (u) => (u?.disputeRate ?? 1) === 0 && (u?.totalJobsCompleted || 0) >= 3,
    color: 'green',
  },
  {
    id: 'identity_verified',
    icon: '🔗',
    title: 'Identity Verified',
    description: 'Add LinkedIn and GitHub or portfolio URL',
    condition: (u, p) => !!(p?.linkedinUrl && (p?.githubUrl || p?.portfolioUrl)),
    color: 'violet',
  },
  {
    id: 'portfolio_pro',
    icon: '📎',
    title: 'Portfolio Pro',
    description: 'Upload 2+ portfolio samples and a resume',
    condition: (u, p) => (p?.projectSamples?.length || 0) >= 2 && !!p?.resumeUrl,
    color: 'violet',
  },
  {
    id: 'skilled',
    icon: '🎯',
    title: 'Skilled Expert',
    description: 'Add 5 or more skills to your profile',
    condition: (u, p) => (p?.skills?.length || 0) >= 5,
    color: 'blue',
  },
  {
    id: 'complete',
    icon: '✅',
    title: 'Profile Complete',
    description: 'Reach 100% profile completion',
    condition: (u, p) => (p?.completionPercent || 0) >= 100,
    color: 'emerald',
  },
]

export const CLIENT_BADGES = [
  {
    id: 'payment_verified',
    icon: '💳',
    title: 'Payment Verified',
    description: 'Verify a payment method via Razorpay',
    condition: (u, p) => !!p?.paymentVerified,
    color: 'emerald',
  },
  {
    id: 'trusted_client',
    icon: '🤝',
    title: 'Trusted Client',
    description: 'Successfully complete 3+ projects',
    condition: (u, p) => (p?.projectsCompleted || 0) >= 3,
    color: 'amber',
  },
  {
    id: 'first_project',
    icon: '🚀',
    title: 'First Project',
    description: 'Post your first job on FreeLock',
    condition: (u, p) => (p?.projectsPosted || 0) >= 1,
    color: 'blue',
  },
  {
    id: 'experienced',
    icon: '🎖️',
    title: 'Experienced Hirer',
    description: '3+ years of hiring freelancers',
    condition: (u, p) => ['3-5', '5+'].includes(p?.yearsHiring),
    color: 'amber',
  },
  {
    id: 'identity_verified',
    icon: '🔗',
    title: 'Identity Verified',
    description: 'Add bio, location and LinkedIn URL',
    condition: (u, p) => !!(p?.bio && p?.location && p?.linkedinUrl),
    color: 'violet',
  },
  {
    id: 'complete',
    icon: '✅',
    title: 'Profile Complete',
    description: 'Reach 100% profile completion',
    condition: (u, p) => (p?.completionPercent || 0) >= 100,
    color: 'emerald',
  },
]

export const BADGE_COLORS = {
  amber:   { earned: 'bg-amber-50 border-amber-200 text-amber-800',    icon: 'bg-amber-100' },
  blue:    { earned: 'bg-blue-50 border-blue-200 text-blue-800',       icon: 'bg-blue-100' },
  green:   { earned: 'bg-green-50 border-green-200 text-green-800',    icon: 'bg-green-100' },
  violet:  { earned: 'bg-violet-50 border-violet-200 text-violet-800', icon: 'bg-violet-100' },
  emerald: { earned: 'bg-emerald-50 border-emerald-200 text-emerald-800', icon: 'bg-emerald-100' },
}

/**
 * Compute earned/locked badge split.
 * @param {string} role  'freelancer' | 'client'
 * @param {object} user  Full User doc
 * @param {object} portfolio  Portfolio doc
 * @returns {{ earned: Badge[], locked: Badge[], total: number }}
 */
export function computeBadges(role, user, portfolio) {
  const all = role === 'freelancer' ? FREELANCER_BADGES : CLIENT_BADGES
  const earned = all.filter(b => b.condition(user, portfolio))
  const locked = all.filter(b => !b.condition(user, portfolio))
  return { earned, locked, total: all.length }
}

/**
 * Persist badge summary to localStorage so the Navbar can render it
 * without making an API call.
 */
export function storeBadgeSummary(role, user, portfolio) {
  const { earned, total } = computeBadges(role, user, portfolio)
  localStorage.setItem('earnedBadgeCount', String(earned.length))
  localStorage.setItem('totalBadgeCount', String(total))
  localStorage.setItem('earnedBadgeIds', JSON.stringify(earned.map(b => b.id)))
}
