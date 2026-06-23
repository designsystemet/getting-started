import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import autoprefixer from "autoprefixer";
import cssnano from "cssnano";
import postcss from "postcss";
import postcssImport from "postcss-import";
import postcssNesting from "postcss-nesting";

export default {
	plugins: [
		postcssImport,
		postcssComposes(),
		postcssNesting,
		cssnano({
			preset: "default",
		}),
		autoprefixer,
	],
};

// A relative or absolute filesystem path, as opposed to a bare package
// specifier that must be resolved from `node_modules`.
function isRelativeSpecifier(from) {
	return (
		from.startsWith("./") ||
		from.startsWith("../") ||
		from === "." ||
		from === ".." ||
		path.isAbsolute(from)
	);
}

function postcssComposes() {
	// Cache parsed source files across all `@composes` rules in a build.
	const cache = {};

	return {
		// Allows `@composes classname from './file.css'` directive, where the
		// source can be a relative path or an installed package/dependency such
		// as `@composes ds-button from "@digdir/designsystemet-css"`.
		postcssPlugin: "@composes",
		AtRule: {
			composes: async (rule) => {
				const sanitizedParams = rule.params.replace(/["']/g, "").trim();
				const [selector, from] = sanitizedParams.split(/\s+from\s+/);

				const fromFile = rule.source.input.file;
				const resolvedFrom = isRelativeSpecifier(from)
					? path.resolve(path.dirname(fromFile), from)
					: // Bare specifier (e.g. `@digdir/designsystemet-css` or
						// `@digdir/designsystemet-css/button.css`): resolve it through
						// Node's module resolution so the package's `exports`/`main`
						// field decides which CSS file to read. Resolving relative to
						// the importing file mirrors how bundlers locate dependencies.
						createRequire(fromFile).resolve(from);

				if (!cache[resolvedFrom])
					cache[resolvedFrom] = await postcss([]).process(
						fs.readFileSync(resolvedFrom),
						{
							from: resolvedFrom,
						},
					);

				// Match `.${selector}` as a complete class name, i.e. only when it is
				// not immediately followed by another class-name character (`\w` or
				// `-`). This matches `.ds-button`, `.ds-button:hover`,
				// `.ds-button[data-x]`, `.ds-button .child` and every selector in a
				// comma-separated group, while excluding unrelated classes such as
				// `.ds-button-large`.
				const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
				const selectorPattern = new RegExp(`\\.${escaped}(?![\\w-])`, "g");

				// Collect every replacement node first, then swap `@composes` for all
				// of them in a single `replaceWith`. Calling `replaceWith` per match
				// would only work for the first one: it detaches `@composes` from the
				// tree, so any later call becomes a silent no-op.
				const replacements = [];

				// Track emitted `@layer` blocks by their layer name so every source
				// rule from the same cascade layer is collected into a single
				// `@layer ds.components { ... }` block instead of one block per rule.
				const layersByName = new Map();

				cache[resolvedFrom].root.walkRules((fromRule) => {
					selectorPattern.lastIndex = 0;
					if (!selectorPattern.test(fromRule.selector)) return;

					// Replace every occurrence of `.${selector}` (a comma-separated
					// group may contain several) with the nesting selector `&`.
					const newSelector = fromRule.selector.replace(selectorPattern, "&");

					// When the source rule's selector is exactly `.${selector}` (no
					// trailing pseudo-classes/elements), inline its children directly
					// into the parent of `@composes` instead of wrapping them in a
					// `& { ... }` rule. This makes `@composes` work inside
					// pseudo-elements (e.g. `::before`), where postcss-nesting would
					// otherwise produce an invalid `:is(...::before)` selector.
					let nodes =
						newSelector === "&"
							? fromRule.nodes.map((node) => node.clone())
							: [fromRule.clone({ selector: newSelector })];

					// Preserve the at-rule context of the source rule by re-wrapping
					// the result in clones of its ancestor at-rules, from the innermost
					// outward. This keeps the composed declarations in the same cascade
					// layer (`@layer ds.components`) and conditional context
					// (`@media`/`@supports`) they had in the source file — including
					// nested chains such as `@layer ds.components { @media ... }`.
					// Without this the rule would be hoisted out of its enclosing
					// `@layer`/`@media`/`@supports` block.
					for (
						let parent = fromRule.parent;
						parent && parent.type === "atrule";
						parent = parent.parent
					) {
						const wrapper = parent.clone();
						wrapper.removeAll();
						wrapper.append(...nodes);
						nodes = [wrapper];
					}

					// Merge into an already-emitted `@layer` block of the same name so
					// the output keeps a single block per cascade layer. The first
					// rule from a layer establishes the block (kept at its source
					// position); later rules append their content into it.
					for (const node of nodes) {
						if (node.type === "atrule" && node.name === "layer") {
							const existing = layersByName.get(node.params);
							if (existing) {
								existing.append(...node.nodes);
								continue;
							}
							layersByName.set(node.params, node);
						}
						replacements.push(node);
					}
				});

				rule.replaceWith(...replacements);
			},
		},
	};
}
