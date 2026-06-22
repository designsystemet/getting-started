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

				cache[resolvedFrom].root.walkRules((fromRule) => {
					if (fromRule.selector.split(/:|\s/)[0] === `.${selector}`) {
						const newSelector = fromRule.selector.replace(`.${selector}`, "&");

						// When the source rule's selector is exactly `.${selector}` (no
						// trailing pseudo-classes/elements), inline its children directly
						// into the parent of `@composes` instead of wrapping them in a
						// `& { ... }` rule. This makes `@composes` work inside
						// pseudo-elements (e.g. `::before`), where postcss-nesting would
						// otherwise produce an invalid `:is(...::before)` selector.
						if (newSelector === "&") {
							rule.replaceWith(fromRule.nodes.map((node) => node.clone()));
						} else {
							rule.replaceWith(fromRule.clone({ selector: newSelector }));
						}
					}
				});
			},
		},
	};
}
