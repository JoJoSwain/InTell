export default function NoAccessPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg px-6 text-center">
      <p className="text-xs uppercase tracking-[0.18em] text-primary">
        Replaceplace
      </p>
      <h1 className="mt-3 font-serif text-3xl font-semibold">No access</h1>
      <p className="mt-3 max-w-md text-textMuted">
        You are signed in, but you do not have an active staff account for
        InTell. Ask an admin for an invite.
      </p>
      <form action="/auth/sign-out" method="post" className="mt-8">
        <button
          type="submit"
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}
