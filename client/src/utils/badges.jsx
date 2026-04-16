// Shared badge definitions used by ProfileSetup (own profile) and
// FreelancerProfile / ClientProfile (public profile view).
//
// condition(user, portfolio) → boolean
//   user      = full User doc (has rating, totalJobsCompleted, onTimeDeliveryRate, disputeRate)
//   portfolio = Portfolio doc

const BadgeIcons = {
  trophy: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
    </svg>
  ),
  star: (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  ),
  clock: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  shield: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  link: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  ),
  paperclip: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
    </svg>
  ),
  sparkles: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  ),
  checkCircle: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  creditCard: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  ),
  handshake: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  rocket: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  award: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
}

export const FREELANCER_BADGES = [
  {
    id: 'top_rated',
    icon: BadgeIcons.trophy,
    title: 'Top Rated',
    description: 'Rating ≥ 4.5 with 5+ completed jobs',
    condition: (u) => (u?.rating || 0) >= 4.5 && (u?.totalJobsCompleted || 0) >= 5,
    color: 'amber',
  },
  {
    id: 'rising_star',
    icon: BadgeIcons.star,
    title: 'Rising Star',
    description: 'Complete 1+ job with rating ≥ 4.0',
    condition: (u) => (u?.rating || 0) >= 4.0 && (u?.totalJobsCompleted || 0) >= 1,
    color: 'amber',
  },
  {
    id: 'on_time',
    icon: BadgeIcons.clock,
    title: 'On-Time Pro',
    description: '90%+ on-time delivery over 3+ jobs',
    condition: (u) => (u?.onTimeDeliveryRate || 0) >= 90 && (u?.totalJobsCompleted || 0) >= 3,
    color: 'blue',
  },
  {
    id: 'dispute_free',
    icon: BadgeIcons.shield,
    title: 'Dispute-Free',
    description: 'Zero disputes across 3+ completed jobs',
    condition: (u) => (u?.disputeRate ?? 1) === 0 && (u?.totalJobsCompleted || 0) >= 3,
    color: 'green',
  },
  {
    id: 'identity_verified',
    icon: BadgeIcons.link,
    title: 'Identity Verified',
    description: 'Add LinkedIn and GitHub or portfolio URL',
    condition: (u, p) => !!(p?.linkedinUrl && (p?.githubUrl || p?.portfolioUrl)),
    color: 'violet',
  },
  {
    id: 'portfolio_pro',
    icon: BadgeIcons.paperclip,
    title: 'Portfolio Pro',
    description: 'Upload 2+ portfolio samples and a resume',
    condition: (u, p) => (p?.projectSamples?.length || 0) >= 2 && !!p?.resumeUrl,
    color: 'violet',
  },
  {
    id: 'skilled',
    icon: BadgeIcons.sparkles,
    title: 'Skilled Expert',
    description: 'Add 5 or more skills to your profile',
    condition: (u, p) => (p?.skills?.length || 0) >= 5,
    color: 'blue',
  },
  {
    id: 'complete',
    icon: BadgeIcons.checkCircle,
    title: 'Profile Complete',
    description: 'Reach 100% profile completion',
    condition: (u, p) => (p?.completionPercent || 0) >= 100,
    color: 'emerald',
  },
]

export const CLIENT_BADGES = [
  {
    id: 'payment_verified',
    icon: BadgeIcons.creditCard,
    title: 'Payment Verified',
    description: 'Verify a payment method via Razorpay',
    condition: (u, p) => !!p?.paymentVerified,
    color: 'emerald',
  },
  {
    id: 'trusted_client',
    icon: BadgeIcons.handshake,
    title: 'Trusted Client',
    description: 'Successfully complete 3+ projects',
    condition: (u, p) => (p?.projectsCompleted || 0) >= 3,
    color: 'amber',
  },
  {
    id: 'first_project',
    icon: BadgeIcons.rocket,
    title: 'First Project',
    description: 'Post your first job on FreeLock',
    condition: (u, p) => (p?.projectsPosted || 0) >= 1,
    color: 'blue',
  },
  {
    id: 'experienced',
    icon: BadgeIcons.award,
    title: 'Experienced Hirer',
    description: '3+ years of hiring freelancers',
    condition: (u, p) => ['3-5', '5+'].includes(p?.yearsHiring),
    color: 'amber',
  },
  {
    id: 'identity_verified',
    icon: BadgeIcons.link,
    title: 'Identity Verified',
    description: 'Add bio, location and LinkedIn URL',
    condition: (u, p) => !!(p?.bio && p?.location && p?.linkedinUrl),
    color: 'violet',
  },
  {
    id: 'complete',
    icon: BadgeIcons.checkCircle,
    title: 'Profile Complete',
    description: 'Reach 100% profile completion',
    condition: (u, p) => (p?.completionPercent || 0) >= 100,
    color: 'emerald',
  },
]

export const BADGE_COLORS = {
  amber:   { earned: 'bg-zinc-50 border-zinc-200 text-zinc-800', icon: 'bg-zinc-900 text-white' },
  blue:    { earned: 'bg-zinc-50 border-zinc-200 text-zinc-800', icon: 'bg-zinc-900 text-white' },
  green:   { earned: 'bg-zinc-50 border-zinc-200 text-zinc-800', icon: 'bg-zinc-900 text-white' },
  violet:  { earned: 'bg-zinc-50 border-zinc-200 text-zinc-800', icon: 'bg-zinc-900 text-white' },
  emerald: { earned: 'bg-zinc-50 border-zinc-200 text-zinc-800', icon: 'bg-zinc-900 text-white' },
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
