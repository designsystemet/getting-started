# @org/my-css

A small CSS component library authored with **CSS Modules** and bundled with
[**tsdown**](https://tsdown.dev) (which is powered by [rolldown](https://rolldown.rs))
plus the [`@tsdown/css`](https://www.npmjs.com/package/@tsdown/css) plugin.

> Rename `@org/my-css` to your own npm scope/name before publishing.

## What the build produces

Running `npm run build` emits to `dist/`:

| File            | What it is                                                        |
| --------------- | ----------------------------------------------------------------- |
| `index.mjs`     | Per-component class maps (`{ local: "scoped" }`), tree-shakeable.  |
| `index.d.mts`   | Self-contained TypeScript types for those maps.                   |
| `style.css`     | All component CSS, with scoped class names, merged into one file.  |

Class names are scoped at build time (e.g. `.button` -> `.myds_button_a1b2c3`),
so the JS map is the source of truth for which class to apply.

## Usage

Install the library (and, if you use the design-system components, the peer):

```sh
npm install @org/my-css @digdir/designsystemet-css
```

Import the stylesheet once (e.g. at your app root), then use the class maps:

```ts
// Load the design system's global classes + tokens (only if you compose them)
import "@digdir/designsystemet-css";
// Load this library's compiled, scoped CSS
import "@org/my-css/styles.css";

import { button, label } from "@org/my-css";

const el = document.createElement("button");
el.className = button.button; // -> "myds_button_a1b2c3"
```

### React

```tsx
import "@org/my-css/styles.css";
import { button } from "@org/my-css";

export function Buy() {
  return <button className={button.button}>Buy now</button>;
}
```

## Authoring components

1. Add `src/components/<name>/<name>.module.css`. Class names are local by default.
2. Re-export its class map from `src/index.ts`:

   ```ts
   import widgetStyles from "./components/widget/widget.module.css";
   export const widget: Styles = widgetStyles;
   ```

3. To build on a Design System class, compose it from the global scope so it
   stays un-scoped and matches the class the consumer loads:

   ```css
   .label {
     composes: ds-label from global;
     color: var(--ds-color-text-default);
   }
   ```

## Scripts

- `npm run build` – bundle to `dist/`
- `npm run dev` – rebuild on change (`tsdown --watch`)
- `npm run typecheck` – `tsc --noEmit`

Tweak scoped-name format or enable CSS minification in
[`tsdown.config.ts`](./tsdown.config.ts).
