# Vendored packages

Packages built from source because no npm release fits this project.

## blockly-plugin-workspace-multiselect-1.0.2-blockly12-f26447c-patch1.tgz

[@mit-app-inventor/blockly-plugin-workspace-multiselect](https://github.com/mit-cml/workspace-multiselect),
built from the Blockly 12 branch in the upstream pull request
[mit-cml/workspace-multiselect#133](https://github.com/mit-cml/workspace-multiselect/pull/133)
at commit `f26447c663db75ce685edf10ccb8df006a4f76ad` (2026-05-16), plus one
local patch, `workspace-multiselect-release-group-on-blur.patch`. The npm
release (1.0.2) only supports Blockly 11 and throws on selection under 12.

The patch: under Blockly 12, clicking the workspace background moves focus
without firing a selection event, so the plugin's group lost its highlight
but kept its members, and the next drag of any one of them still moved them
all. The group now releases its members when it loses focus for good (not
for a field editor or a menu, and not while multi-select mode is active).
Worth offering upstream.

When the upstream release supports Blockly 12 (and no longer needs the
patch), replace the `file:` entry in package.json with the published version
and delete the tarball and patch.

To rebuild from a newer commit:

```sh
git clone https://github.com/mjgallag/workspace-multiselect.git
cd workspace-multiselect
git checkout <commit>
git apply <this folder>/workspace-multiselect-release-group-on-blur.patch
npm install --ignore-scripts
npx blockly-scripts build
npm pack --ignore-scripts
```

Copy the resulting `.tgz` here with the commit in its name, then run
`npm install ./vendor/<file>.tgz` from the project root.
