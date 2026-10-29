# Testing the screens without an account

There is no Node on Alex's Mac; GitHub builds every push to main into the branch `web`.

1. `git clone -b web git@github.com:alexisdigipro-hub/roarlist.git web` (somewhere outside the repo)
2. Copy `dev/mock.js` next to its `index.html`, and make `mock.html` from `index.html` by adding
   `<script src="./mock.js"></script>` before the module script (the app uses `window.roarlist` if it is there).
3. Serve the folder (`python3 -m http.server`) and open `/mock.html`: a "desktop" api kept in memory, no account.
   `/index.html#demo` shows the Lab's example.

Never copy mock.* to themadlions-site.
