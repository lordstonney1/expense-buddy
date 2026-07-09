## Decision: Keep current Supabase Auth

No changes needed. The existing auth setup is the right fit for CediTrack:

- Email/password + Google sign-in are working
- Password reset and email verification flows are in place
- RLS policies on `expenses` and `profiles` are keyed to `auth.uid()` — swapping to Clerk would break these
- Protected route gate (`_authenticated`) and bearer middleware are wired correctly

## Why not Clerk

- Not supported on Lovable Cloud's managed auth
- Would require rewriting all RLS policies to validate Clerk JWTs
- Adds cost and complexity with no benefit at this scope

## Next steps

Nothing to build for this request. When you're ready, we can move on to other features — for example:

- A monthly budget / spending limit with progress indicator
- Category breakdown chart on the dashboard
- Recurring expense templates (e.g. weekly transport, hostel fees)
- Profile page to edit name/school and change password
- Dark mode

Let me know which direction you'd like to go next.