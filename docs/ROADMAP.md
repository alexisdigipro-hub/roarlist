# RoarList: where it stands and what is open

TheMadlions Lab, Experiment 04. Web at themadlions.com/roarlist (example without an account: /roarlist/#demo),
desktop for Mac and Windows from this repo's releases. Listed on themadlions.com/lab and the home page's Lab section.

## Done (to 0.4.x)
- Shot lists: scenes, shots (size, angle, movement, lens, description, cast, duration, notes, done), a frame per shot,
  list and storyboard views, drag to reorder, undo, paste/drop images.
- Export: PDF list, PDF storyboard, self-contained .html, .roarlist file.
- Web: RoarMe account (same as RoarMe, Roardino, RoarMail), lists in RoarMe's Supabase (`supabase/roarlist.sql`:
  roarlist_projects, roarlist_settings, private bucket roarlist-images; RLS checked: only the owner reads or writes).
  Lists made in a browser before accounts move into the account on first sign-in.
- RoarMe's design system: Simba and Pumba, dark/light/auto with the circle wipe, accent, font, text size, spacing,
  corners, glass buttons, animations, focus rings, power saving; RoarMe-style Settings; Cmd K search, Cmd , settings,
  Cmd / shortcuts, right-click menu, resizable side panel.
- Desktop: same screens, lists kept on the computer (no account yet).

## Open decisions (waiting for Alex)
1. Which ways to connect RoarList with RoarMe to build first:
   1. A RoarList tile in the chat, like Ordino (`?embed=1` frame, access token by postMessage, the list posted as a card).
   2. A read-only link for the crew that opens without an account and shows as a card in RoarMe (like Roardino's link).
   3. A shot list shared with a RoarMe group, edited together live.
   4. Shoot progress in the chat: ticking a shot posts "1A done, 12/30".
   5. Shots that become RoarMe Tasks, with "done" coming back to the list.
   6. The shoot day in RoarMe's calendar, with a reminder.
   7. Link with Roardino: the day's ordino shows its shots.
   8. The RoarMe account in the desktop app too, syncing with the cloud like the web.
2. RoarMail: what a RoarMe account should do there (sync settings and mail accounts between computers with
   passwords kept local; send an email as a card into a RoarMe chat; or just the same profile and look).
3. The home page Lab section jumps from Experiment 02 to 04 because RoarMail (03) is not on it; add it or not.

## Rules that hold
- Pushing a release tag (`desktop-vX.Y.Z`) and pushing to themadlions-site need Alex's OK each time.
- Live database changes on RoarMe's Supabase need Alex's OK.
- Never sign in with a real account to test; use `dev/mock.js` (see dev/README.md).
