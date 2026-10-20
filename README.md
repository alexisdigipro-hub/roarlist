# RoarList

Shot lists and storyboards for shoots, for Mac and Windows, in the THEMADLIONS look. TheMadlions Lab, Experiment 04.

- Scenes and shots: size, angle, movement, lens, description, cast, duration, notes, a tick when it is shot.
- A frame per shot (reference still or sketch): drop, paste or choose an image. List view and storyboard view.
- Export: PDF list, PDF storyboard (A4 landscape), a self-contained web page, or a `.roarlist` file someone else opens in RoarList.
- Everything stays on this computer (`<userData>/projects/<id>/project.json` + `images/`). No account, no server.

## Layout

- `src/main` window, storage (`store.ts`), PDF, menu, updater
- `src/preload` the desktop implementation of `ListApi`
- `src/shared` `ListApi` and the types (`api.ts`), the printed page (`print.ts`)
- `src/renderer` the screens (React)

## Build

`npm install`, then `npm start` to run, `npm run dist:mac` / `npm run dist:win` for installers.
Releases: bump `version` in package.json, push, then push a tag `desktop-vX.Y.Z`.
