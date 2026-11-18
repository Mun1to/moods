<!-- mods:start -->
## Changing how <App> looks: make a mod, do not edit the app

<App> has mods (see `MODS.md`). When someone asks you to change the app **for themselves** (its
colors, its letter, its sizes, its corners, the order of its parts, hiding a part), do not edit the
source and do not fork the repository. Write a mod in their mods folder. A mod stays on after every
update of the app; an edited copy stops getting updates.

- The names a mod may use are in `<contract.json>`. Nothing else is safe to rely on.
- Check the mod before saying it is done: `node check.mjs <contract.json> <the mod folder>`
  ([check.mjs](<check.mjs>) comes with the mods plugin).
- If the change needs a name the contract does not have, say so and offer to open an issue asking
  for that name. Do not work around it by editing the app.
- Edit the source only when the change is meant for everyone (a contribution) or it is behavior
  that no mod can express. Say which of the two it is before you start.
<!-- mods:end -->
