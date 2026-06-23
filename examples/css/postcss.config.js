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
					if (newSelector === "&") {
						for (const node of fromRule.nodes) replacements.push(node.clone());
						return;
					}

					const rewritten = fromRule.clone({ selector: newSelector });

					// Preserve the at-rule context of nested rules (e.g. a rule inside
					// `@media (hover: hover)`) by re-wrapping the rewritten rule in a
					// clone of its parent at-rule. Without this the rule would be
					// hoisted out of its `@media`/`@supports` block.
					const { parent } = fromRule;
					if (parent && parent.type === "atrule") {
						const wrapper = parent.clone();
						wrapper.removeAll();
						wrapper.append(rewritten);
						replacements.push(wrapper);
					} else {
						replacements.push(rewritten);
					}
				});

				rule.replaceWith(...replacements);
			},
		},
	};
}
