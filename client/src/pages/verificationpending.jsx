export default function VerificationPending() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-100">
      <div className="bg-white p-8 rounded-xl shadow text-center max-w-md">
        <h1 className="text-xl font-semibold mb-2">Verification Pending</h1>
        <p className="text-zinc-600 text-sm">
          Your account is under review by admin.
          <br />
          You will be able to use the platform once verified.
        </p>
      </div>
    </div>
  )
}