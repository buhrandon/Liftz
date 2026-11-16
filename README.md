# Lift

A one-screen workout tracker for a 4-day Upper/Lower split. It shows the next exercise, logs weight × reps, remembers what you did last time, and syncs to a free Supabase database.

It works with **no database at all**: leave `config.js` blank and everything is saved on your phone. Add the database whenever you're ready, and whatever you've already logged gets uploaded automatically.

## Files

| File | What it is |
|---|---|
| `index.html` | The whole app |
| `config.js` | Your Supabase URL + key (blank = phone-only mode) |
| `schema.sql` | Database tables, security rules, and handy views. Paste it into Supabase once. |
| `manifest.webmanifest`, `icon-*.png` | Home-screen app icon and name |
| `sw.js` | Lets the app open offline and lets Android install it |
| `README.md` | This guide |

---

## Part 1: Put the app online (GitHub Pages, ~2 min)

1. Create a new **public** repo on GitHub, e.g. `lift`.
2. **Add file → Upload files**, then drop in `index.html`, `config.js`, `schema.sql`, `manifest.webmanifest`, `sw.js`, and the three `icon-*.png` files, and commit.
3. **Settings → Pages**: set Source to **Deploy from a branch**, branch `main`, folder `/ (root)`, then click **Save**.
4. About a minute later, open `https://<your-username>.github.io/lift/` on your phone.
5. Tap **Install** on the banner in the app. Android shows the install popup. iPhone shows the Share → **Add to Home Screen** steps, since Apple doesn't let websites do it automatically.

At this point the app works in phone-only mode. The footer says *"Saved on this phone only."*

---

## Part 2: Set up the database (Supabase, ~15 min)

### Step 1: Create the project
1. Sign up at **supabase.com** (free tier is plenty).
2. **New project** → name it `lift` → set a database password (save it in your password manager) → pick region **West US**.
3. Wait about 2 minutes for it to finish setting up.

### Step 2: Create the tables
1. Left sidebar → **SQL Editor** → **New query**.
2. Paste the entire contents of `schema.sql` → **Run**.
3. You should see *"Success. No rows returned."*
4. Check **Table Editor**. It should list `sets`, `bodyweight`, and `user_plan`.

### Step 3: Set up sign-in by email code
The app signs you in with a 6-digit code sent to your email. A code works inside the home-screen app. A link would open in Safari instead, and Safari keeps a separate login from the home-screen app.

1. **Authentication → Sign In / Providers → Email**: make sure **Email** is enabled.
2. **Authentication → Email Templates → Magic Link**: replace the body with:
   ```html
   <h2>Your Lift sign-in code</h2>
   <p style="font-size:28px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>
   <p>Or <a href="{{ .ConfirmationURL }}">tap here to sign in</a> in your browser.</p>
   ```
3. Do the same for the **Confirm signup** template. Supabase uses it the very first time you sign in.
4. **Authentication → URL Configuration**:
   - **Site URL:** `https://<your-username>.github.io/lift/`
   - **Redirect URLs:** add the same URL

### Step 4: Connect the app
1. **Project Settings → API** (or the **Connect** button at the top).
2. Copy the **Project URL** and the **anon / public** key.
3. Paste them into `config.js`:
   ```js
   window.LIFT_CONFIG = {
     supabaseUrl: "https://abcdefghijkl.supabase.co",
     supabaseAnonKey: "eyJhbGciOi...",
   };
   ```
4. On GitHub, open `config.js` → ✏️ edit → paste → **Commit**.

> The **anon** key is meant to be public, so it's fine for it to be visible on GitHub Pages. Your data is protected by the row-level security rules in `schema.sql`: every row belongs to a user, and only that signed-in user can read or change it. **Never** put the `service_role` key in this app.

### Step 5: Sign in
1. Open the app. If it doesn't update, close it fully and reopen.
2. It now shows a **Sign in** screen. Enter your email → **Send code** → type the 6-digit code → **Sign in**.
3. Everything you logged in phone-only mode uploads automatically. The footer should say **● Synced**.

### Step 6: Lock it to just you (recommended)
Once you've signed in once, **Authentication → Sign In / Providers → turn off "Allow new users to sign up."** Your account keeps working, and nobody else can create one on your project.

### Step 7 (optional): Move the plan into the database
1. In the app: **Dashboard → Save plan to database**.
2. From then on, edit exercises in **Table Editor → user_plan → `plan`**. It's JSON shaped like this:
   ```json
   [{ "name": "Upper A", "when": "Monday",
      "blocks": [ [ { "n": "Flat barbell bench", "r": "6–10", "note": "Stop 1 rep shy" } ],
                  [ { "n": "Hammer curls", "r": "10–12", "note": "" },
                    { "n": "Rope pushdowns", "r": "10–12", "note": "" } ] ] }]
   ```
   Each inner list is one screen in the app. Two exercises in one list makes a superset.
3. The app picks up changes the next time it's opened.

> Keep exercise names exactly the same when you edit. "Last time" and the dashboard match on the name, so renaming *Flat barbell bench* starts that exercise's history over.

---

## Test checklist

Run through this once after setup:

- [ ] Footer shows **● Synced**
- [ ] Log a set → **Table Editor → sets** shows the new row
- [ ] Tap **Undo** → the row disappears from Supabase
- [ ] Turn on airplane mode → log a set → footer says *Offline · 1 waiting to sync* → turn airplane mode off → it changes to **Synced**
- [ ] Open the app on a second device and sign in → "Last Upper A" and the Dashboard show the same history
- [ ] Dashboard → log a bodyweight → it appears in **Table Editor → bodyweight**
- [ ] (After Step 6) Try to sign in with a different email → it should be refused

---

## How syncing works

- Every change is saved **on the phone first**, so the app never waits on the internet, even mid-set at the gym.
- Changes go into a **waiting list**, which is sent to Supabase as soon as you're signed in and online. If sending fails, the app retries on the next change, when the connection comes back, or when you reopen the app.
- When the app opens, it **pulls your full history** from Supabase. Anything still waiting to be sent is kept, not overwritten.
- Every set has a unique ID, so sending the same set twice never creates a duplicate.

**Footer status:**

| Status | Meaning |
|---|---|
| ● Synced | Everything is in the database |
| ● Syncing 3… / Offline · 3 waiting | Saved on the phone, will upload |
| ● Sync problem · will retry | Supabase returned an error (see below) |
| Not signed in | You tapped "Continue without syncing". Data is waiting and uploads once you sign in |

## Backups (no database needed)

Without the database, everything lives in the phone's browser storage. That's wiped if the app is deleted from the home screen, Safari's website data is cleared, or the phone is replaced. To protect it:

- **Dashboard → Back up now** opens the share sheet. Tap **Save to Files** and pick iCloud Drive or Google Drive. You get one `lift-backup-YYYY-MM-DD.json` file with every set, weigh-in, and the plan.
- **Dashboard → Restore** loads a backup file. It merges with what's already there, so restoring the same file twice never duplicates anything.
- If it's been more than 7 days since the last backup, the workout-complete screen shows a reminder.
- The app also asks the browser for "persistent storage," so the phone doesn't auto-clear it.

If the database is connected, restored data also uploads to Supabase.

## Looking at your data in Supabase

`schema.sql` also creates three read-only views:

| View | What it shows |
|---|---|
| `exercise_bests` | Your best set ever for each exercise, with estimated 1-rep max |
| `exercise_progress` | Your top set per exercise per workout day. Chart `est_1rm_lb` over `date` to see your strength curve |
| `weekly_summary` | Workouts, sets, and total volume (lb × reps) per week |

Example query in the SQL Editor:
```sql
select date, weight_lb, reps, est_1rm_lb
from exercise_progress
where exercise = 'Flat barbell bench'
order by date;
```

## Troubleshooting

| Problem | Fix |
|---|---|
| No sign-in screen after adding keys | Make sure `config.js` was committed and GitHub Pages redeployed (~1 min). Close and reopen the app. |
| "Sync problem" | On a computer, open the app → right-click → Inspect → Console. The error is logged there. Most common cause: `schema.sql` wasn't run, or a typo in the URL/key. |
| Email has a link but no code | The template edit in Step 3 didn't save. Check **both** Magic Link and Confirm signup. |
| "Signups not allowed" on first sign-in | You did Step 6 before Step 5. Turn sign-ups back on, sign in, then turn them off again. |
| Free project paused | Supabase pauses free projects after ~1 week with no activity. Click **Restore** in the dashboard. Your data is kept, and the app keeps saving on the phone meanwhile. |

## Changing the plan without the database

Edit `DEFAULT_PLAN` near the top of the script in `index.html`. Once a plan has been saved to the database (Step 7), the database copy wins.
