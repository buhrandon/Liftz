# Lift

A one-screen workout tracker. Pick a routine (or build your own), and it shows the next exercise, logs weight × reps, remembers what you did last time, and syncs everything to a free Supabase database.

Everyone signs in with email + password (or Google), so their lifts follow them to any device. Sets logged with no signal are saved on the phone and upload when the connection comes back.

## Files

| File | What it is |
|---|---|
| `index.html` | The whole app |
| `config.js` | Your Supabase URL + publishable key, and the Google sign-in switch |
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

The app needs the database (Part 2) before anyone can sign in and log lifts.

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

### Step 3: Turn on email + password sign-in
People sign up with an email and password, right in the app. No emails are sent, so it's free and works for anyone.

1. **Authentication → Sign In / Providers → Email**:
   - **Enable Email provider:** on
   - **Confirm email:** **off** (Supabase's built-in email only reaches your own team, so confirmation emails would never arrive for other people)
   - Click **Save**.
2. **Authentication → Sign In / Providers**, then the user signups setting: **Allow new users to sign up** = **on**.
3. **Authentication → URL Configuration**:
   - **Site URL:** `https://<your-username>.github.io/<repo>/`
   - **Redirect URLs:** add the same URL (Google sign-in returns here)

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

### Step 5: Create your account
1. Open the app. If it doesn't update, close it fully and reopen.
2. On the **Sign in** screen, tap **Create account**, enter your email and a password (6+ characters), then tap **Create account**.
3. The footer should say **● Synced**, and the header shows your email with a green dot.

Anyone with the link can do the same. Each account only ever sees its own data, enforced by the database rules in `schema.sql`. If a different person signs in on the same phone, the app starts them clean instead of mixing in the last person's lifts.

### Step 6 (optional): Sign in with Google
Free, about 10 minutes, done once:

1. Go to **console.cloud.google.com**, create a project (e.g. "Lift").
2. **APIs & Services → OAuth consent screen**: choose **External**, enter an app name and your email, then save. Add yourself as a test user, or click **Publish app** so anyone can use it.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**
   - **Authorized JavaScript origins:** `https://<your-username>.github.io`
   - **Authorized redirect URIs:** `https://<your-project-ref>.supabase.co/auth/v1/callback`
   - Click **Create** and copy the **Client ID** and **Client secret**.
4. In Supabase: **Authentication → Sign In / Providers → Google**. Turn it on, paste the Client ID and secret, and save.
5. In `config.js`, set `googleSignIn: true` and commit. The **Continue with Google** button appears on the sign-in screen.

> On iPhone, Google sign-in works in Safari. From a home-screen app, iOS may open Google in a separate browser window, so email + password is the most reliable option there.

### Step 7: Your routines sync automatically
Your routines, your own exercises, and which routine is selected are saved to the `user_plan` table as soon as you sign in, and again every time you change them. Sign in on another device and they show up there.

---

## Test checklist

Run through this once after setup:

- [ ] Footer shows **● Synced**
- [ ] Log a set → **Table Editor → sets** shows the new row
- [ ] Tap **Undo** → the row disappears from Supabase
- [ ] Turn on airplane mode → log a set → footer says *Offline · 1 waiting to sync* → turn airplane mode off → it changes to **Synced**
- [ ] Open the app on a second device and sign in → "Last Upper A" and the Dashboard show the same history
- [ ] Dashboard → log a bodyweight → it appears in **Table Editor → bodyweight**
- [ ] Create a second test account → it starts empty and can't see your lifts

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
| "Signups not allowed" | Turn **Allow new users to sign up** back on (Step 3). |
| "Account created. Confirm it from the email…" | **Confirm email** is still on. Turn it off (Step 3), then sign in. |
| Forgot password | In Supabase → **Authentication → Users**, delete the user, then sign up again. Their lifts stay in the `sets` table but won't be linked to the new account. |
| Free project paused | Supabase pauses free projects after ~1 week with no activity. Click **Restore** in the dashboard. Your data is kept, and the app keeps saving on the phone meanwhile. |

## Routines

Open **📊 Dashboard** (footer). The **Routine** section lists every routine.

**Picking a routine:** tap one (Upper / Lower, Push / Pull, Push / Pull / Legs, Bro split, Full body, or one you made), then **Confirm**. The selected routine gets a green outline and a **✓ Selected** badge, and the workout screen switches to it, starting at its first day.

**+ Create routine:**
1. Name the routine.
2. **+ Add workout**, name it (e.g. "Push"), then **+ Add exercise**.
   - Pick from the standard list (grouped by muscle, with search), or **+ Add your own exercise**. Your own exercises are saved under **My exercises** for next time.
   - Set reps, sets (blank = routine default), and a note for each exercise. **+ Superset** pairs exercises on one screen.
3. Back on the routine screen, tap the **days** for each workout. A day belongs to one workout, so tapping a day another workout has moves it over. A workout can have more than one day (e.g. Push on Mon & Thu).
4. Set the default **sets per exercise**, then **Save routine**. It's saved and selected.

Built-in routines can't be changed directly. Tap **Copy & customize** to make your own editable copy. Your routines have **Edit** and **Delete** (tap twice).

**How days work:** the app goes through the routine's days in week order (Mon → Sun), doing the workout assigned to each. If you miss a day, it doesn't skip ahead; it picks up with the next workout in the order.

> Keep workout and exercise names the same to keep your "Last time" history. It matches on workout name + exercise name.

## Changing the starter templates

The built-in routines live in `TEMPLATES` (exercises) and `DEFAULT_DAYS` (days) near the top of the script in `index.html`. The standard exercise list is `EXERCISE_LIBRARY`.
