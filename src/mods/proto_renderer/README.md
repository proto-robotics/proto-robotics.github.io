# PROTO Blockly renderer

`proto_renderer.js` customizes Blockly's block geometry and typography. This
file documents the available extension points and the rules for using them. It
intentionally does not list the renderer's current values, shapes, or connection
mappings; the implementation is the source of truth for configuration that is
expected to change.

## How to override a constant

Set a constant as a class field or in the constant provider's constructor after
calling `super()`:

```js
export class ProtoRendererConstantProvider
	extends Blockly.blockRendering.ConstantProvider {

	CORNER_RADIUS = 5;

	constructor() {
		super();
		this.NOTCH_WIDTH = 14;
		this.NOTCH_HEIGHT = 14;
	}
}
```

Geometry constants must be set before `init()` runs. Blockly uses them during
`super.init()` to construct its standard shape objects. Custom shapes created
afterward can use the same dimensions.

Change one group at a time and check normal blocks, shadow blocks, nested
statements, collapsed blocks, the toolbox flyout, and disabled blocks. Many
constants affect row measurement as well as drawing, so visually compensating
for a bad value with CSS can leave connection coordinates incorrect.

## Available common constants

The following fields on Blockly's common constant provider are available to a
subclass. Blockly's installed
`core/renderers/common/constants.d.ts` is authoritative if the dependency is
upgraded.

### General padding

| Constant | Purpose |
| --- | --- |
| `NO_PADDING` | Empty spacer size. |
| `SMALL_PADDING` | Small standard spacer. |
| `MEDIUM_PADDING` | Medium standard spacer. |
| `MEDIUM_LARGE_PADDING` | Spacer between medium and large. |
| `LARGE_PADDING` | Large standard spacer. |
| `SPACER_DEFAULT_HEIGHT` | Default height for a generic spacer row. |
| `TALL_INPUT_FIELD_OFFSET_Y` | Vertical offset used to align fields in tall inputs. |

### Connections

| Constant | Purpose |
| --- | --- |
| `TAB_WIDTH` | Width of value-input and output tabs. |
| `TAB_HEIGHT` | Height of value-input and output tabs. |
| `TAB_OFFSET_FROM_TOP` | Vertical position of a tab relative to the block top. |
| `TAB_VERTICAL_OVERLAP` | Tab overlap used to produce the puzzle-piece appearance. |
| `NOTCH_WIDTH` | Width of previous- and next-statement notches. |
| `NOTCH_HEIGHT` | Height of previous- and next-statement notches. |
| `NOTCH_OFFSET_LEFT` | Notch offset from the left block or statement edge. |
| `STATEMENT_INPUT_NOTCH_OFFSET` | Notch position on a statement input. |
| `EXTERNAL_VALUE_INPUT_PADDING` | Space around an external value input. |

### Block and row geometry

| Constant | Purpose |
| --- | --- |
| `MIN_BLOCK_WIDTH` | Minimum rendered block width. |
| `MIN_BLOCK_HEIGHT` | Minimum rendered block height. |
| `CORNER_RADIUS` | Radius of rounded outside block corners. |
| `EMPTY_BLOCK_SPACER_HEIGHT` | Spacer height used by an otherwise empty block. |
| `DUMMY_INPUT_MIN_HEIGHT` | Minimum height of a dummy-input row. |
| `DUMMY_INPUT_SHADOW_MIN_HEIGHT` | Minimum dummy-input height on shadow blocks. |
| `EMPTY_INLINE_INPUT_PADDING` | Padding around an empty inline input. |
| `EMPTY_INLINE_INPUT_HEIGHT` | Height of an empty inline input. |
| `EMPTY_STATEMENT_INPUT_HEIGHT` | Height of an empty statement input. |
| `STATEMENT_INPUT_PADDING_LEFT` | Left indentation of a statement input. |
| `STATEMENT_BOTTOM_SPACER` | Space below a statement input. |
| `BETWEEN_STATEMENT_PADDING_Y` | Vertical space between consecutive statement inputs. |
| `TOP_ROW_MIN_HEIGHT` | Minimum height of a block's top row. |
| `TOP_ROW_PRECEDES_STATEMENT_MIN_HEIGHT` | Minimum top-row height when followed by a statement input. |
| `BOTTOM_ROW_MIN_HEIGHT` | Minimum height of a block's bottom row. |
| `BOTTOM_ROW_AFTER_STATEMENT_MIN_HEIGHT` | Minimum bottom-row height after a statement input. |

### Start hats and collapsed blocks

| Constant | Purpose |
| --- | --- |
| `ADD_START_HATS` | Adds a hat to blocks without previous or output connections. A block style can override it. |
| `START_HAT_WIDTH` | Width used to build the start-hat path. |
| `START_HAT_HEIGHT` | Height used to build the start-hat path. |
| `JAGGED_TEETH_WIDTH` | Width of the collapsed-block indicator. |
| `JAGGED_TEETH_HEIGHT` | Height of the collapsed-block indicator. |

### Field text and borders

| Constant | Purpose |
| --- | --- |
| `FIELD_TEXT_FONTSIZE` | Field-text size in points. |
| `FIELD_TEXT_FONTWEIGHT` | CSS font weight for field text. |
| `FIELD_TEXT_FONTFAMILY` | CSS font-family list for field text. |
| `FIELD_TEXT_BASELINE_CENTER` | Whether Blockly centers field text using its baseline. |
| `FIELD_BORDER_RECT_RADIUS` | Corner radius of editable and non-editable field borders. |
| `FIELD_BORDER_RECT_HEIGHT` | Default field-border height. |
| `FIELD_BORDER_RECT_X_PADDING` | Horizontal padding inside field borders. |
| `FIELD_BORDER_RECT_Y_PADDING` | Vertical padding inside field borders. |
| `FIELD_BORDER_RECT_COLOUR` | Background color of field borders. |
| `FULL_BLOCK_FIELDS` | Whether text and color fields fill their source block. |
| `FIELD_TEXTINPUT_BOX_SHADOW` | Whether text-input widgets display a box shadow. |

`FIELD_TEXT_HEIGHT` and `FIELD_TEXT_BASELINE` are calculated from the selected
font by Blockly. They should normally be treated as derived values rather than
manual overrides.

### Dropdown, color, and checkbox fields

| Constant | Purpose |
| --- | --- |
| `FIELD_DROPDOWN_BORDER_RECT_HEIGHT` | Border height used by dropdown fields. |
| `FIELD_DROPDOWN_NO_BORDER_RECT_SHADOW` | Removes the dropdown border on shadow blocks when enabled. |
| `FIELD_DROPDOWN_COLOURED_DIV` | Colors the dropdown menu container to match its block. |
| `FIELD_DROPDOWN_SVG_ARROW` | Uses an SVG arrow instead of a text arrow. |
| `FIELD_DROPDOWN_SVG_ARROW_PADDING` | Padding around the SVG dropdown arrow. |
| `FIELD_DROPDOWN_SVG_ARROW_SIZE` | Size of the SVG dropdown arrow. |
| `FIELD_DROPDOWN_SVG_ARROW_DATAURI` | Image data used for the SVG dropdown arrow. |
| `FIELD_COLOUR_FULL_BLOCK` | Makes a color field display its color across the full block. |
| `FIELD_COLOUR_DEFAULT_WIDTH` | Default color-field width. |
| `FIELD_COLOUR_DEFAULT_HEIGHT` | Default color-field height. |
| `FIELD_CHECKBOX_X_OFFSET` | Horizontal checkbox alignment offset. |

### Cursor, marker, and insertion feedback

| Constant | Purpose |
| --- | --- |
| `CURSOR_COLOUR` | Color of the keyboard or drag cursor. |
| `MARKER_COLOUR` | Color of an immovable marker. |
| `CURSOR_WS_WIDTH` | Width of the workspace cursor. |
| `WS_CURSOR_HEIGHT` | Height of the workspace cursor. |
| `CURSOR_STACK_PADDING` | Cursor padding around a block stack. |
| `CURSOR_BLOCK_PADDING` | Cursor padding around one block. |
| `CURSOR_STROKE_WIDTH` | Cursor outline thickness. |
| `INSERTION_MARKER_COLOUR` | Main insertion-marker color. |
| `INSERTION_MARKER_OPACITY` | Insertion-marker opacity. |

## Method override points

| Method | Use |
| --- | --- |
| `Renderer.makeConstants_()` | Return the constant-provider instance for this renderer. |
| `ConstantProvider.init()` | Build shape objects after dimensions and theme-dependent values are ready. |
| `ConstantProvider.shapeFor(connection)` | Select connection geometry for a rendered connection. |
| `makeNotch()` | Build Blockly's standard statement-notch shape. |
| `makePuzzleTab()` | Build Blockly's standard value-connection tab. |
| `makeStartHat()` | Build the optional start-hat shape. |
| `makeJaggedTeeth()` | Build the collapsed-block indicator. |
| `makeInsideCorners()` | Build corners around statement inputs. |
| `makeOutsideCorners()` | Build the outside block corners. |
| `setTheme(theme)` | Refresh values when the workspace theme changes. |
| `setDynamicProperties_(theme)` | Recalculate theme-dependent provider properties. |
| `setFontConstants_(theme)` | Apply and measure theme font settings. |
| `setComponentConstants_(theme)` | Apply cursor, marker, and insertion styles from the theme. |
| `createDom(...)` | Create renderer-specific SVG definitions, filters, and CSS. |
| `getCSS_(selector)` | Return renderer-specific CSS rules. |
| `dispose()` | Remove DOM resources created by the provider. |

Methods ending in an underscore are protected Blockly implementation hooks.
They can be overridden, but they are more likely to change during a Blockly
upgrade than the project's own methods.

## Derived objects

Blockly creates `NOTCH`, `PUZZLE_TAB`, `START_HAT`, `JAGGED_TEETH`,
`INSIDE_CORNERS`, and `OUTSIDE_CORNERS` during `init()`. Prefer changing their
source dimensions or overriding their `make...()` method instead of assigning
the finished object directly.

The provider also owns internal DOM identifiers, filters, patterns, generated
block styles, and its `SHAPES` registry. Those are runtime state, not normal
appearance settings.
