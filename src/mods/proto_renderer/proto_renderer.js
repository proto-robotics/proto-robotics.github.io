import * as Blockly from 'blockly';
import { SvgPath, reversePath, SvgItem } from 'svg-path-editor-lib';

export class ProtoRenderer extends Blockly.blockRendering.Renderer {
	constructor() {
		super();
	}

	makeConstants_() {
		return new ProtoRendererConstantProvider();
	}
}

export class ProtoRendererConstantProvider extends Blockly.blockRendering.ConstantProvider {

	//optional modifiers
	FIELD_TEXT_FONTSIZE = 10;

	//FIELD_TEXT_FONTWEIGHT = 'bold';

	// FIELD_TEXT_FONTFAMILY = '"Helvetica Neue", "Segoe UI", Helvetica, sans-serif';
	// FIELD_TEXT_FONTFAMILY = 'Ubuntu Mono, monospace';
	FIELD_TEXT_FONTFAMILY = 'Monteserrat, sans-serif';

	constructor() {
		// Set up all of the constants from the base provider.
		super();

		//https://github.com/RaspberryPiFoundation/blockly/blob/master/core/renderers/common/constants.ts to find a full list of constants to override
		/**
		 * Key Constant Categories
		 * Connection Shapes and Sizes
		 * 
		 * NOTCH_WIDTH: Width of the notch used for previous and next connections.
		 * NOTCH_HEIGHT: Height of the notch used for previous and next connections.
		 * TAB_WIDTH: Width of the puzzle tab used for input and output connections.
		 * TAB_HEIGHT: Height of the puzzle tab used for input and output connections.
		 * JAGGED_TEETH_WIDTH: Width of the SVG path for jagged teeth at the end of collapsed blocks.
		 * JAGGED_TEETH_HEIGHT: Height of the SVG path for jagged teeth at the end of collapsed blocks. 
		 * Block Geometry and Spacing
		 * 
		 * CORNER_RADIUS: Rounded corner radius for block edges.
		 * MIN_BLOCK_WIDTH: Minimum width of a block.
		 * MIN_BLOCK_HEIGHT: Minimum height of a block.
		 * BETWEEN_STATEMENT_PADDING_Y: Vertical padding between consecutive statement inputs.
		 * EMPTY_STATEMENT_INPUT_HEIGHT: Height of an empty statement input.
		 * EMPTY_INLINE_INPUT_HEIGHT: Height of an empty inline input.
		 * EMPTY_INLINE_INPUT_PADDING: Padding around an empty inline input.
		 * STATEMENT_BOTTOM_SPACER: Spacing below a statement input. 
		 * Field and Input Styling
		 * 
		 * FIELD_TEXT_FONTSIZE: Point size of text within fields.
		 * FIELD_TEXT_FONTFAMILY: Font family for text within fields.
		 * FIELD_TEXT_FONTWEIGHT: Font weight for text within fields.
		 * FIELD_BORDER_RECT_HEIGHT: Default height of a field's border rectangle.
		 * FIELD_BORDER_RECT_RADIUS: Corner radius of a field's border rectangle.
		 * FIELD_BORDER_RECT_X_PADDING: X padding for a field's border rectangle.
		 * FIELD_BORDER_RECT_Y_PADDING: Y padding for a field's border rectangle.
		 * Colors and Styling
		 * 
		 * CURSOR_COLOUR: Color of the cursor used during dragging.
		 * INSERTION_MARKER_COLOUR: Main color of insertion markers (hex code).
		 * INSERTION_MARKER_OPACITY: Opacity of the insertion marker.
		 * MARKER_COLOUR: Color of immovable markers. 
		 * Miscellaneous
		 * 
		 * LARGE_PADDING, MEDIUM_PADDING, SMALL_PADDING: Standard padding sizes.
		 * NO_PADDING: Size of an empty spacer.
		 * START_HAT_HEIGHT, START_HAT_WIDTH: Dimensions of the top hat on blocks with no previous connection.
		 */

		//width of all vertical connection points

		// this.NOTCH_WIDTH = 14;

		// //height of all vertical connection points
		// this.NOTCH_HEIGHT = 14;

		// //how round the blocks are
		// this.CORNER_RADIUS = 5;

		// // the width of all horizontal connection points
		// this.TAB_WIDTH = 9*1.5;

		// // the height of all horizontal connection points
		// this.TAB_HEIGHT = 8*1.5;

		// // General block spacing
    	// this.MEDIUM_PADDING = 3;        // increases inner spacing
    	// this.TIGHT_PADDING = 6;          // slightly tighter spacing
    	// this.INPUT_PADDING_Y = 8;        // more space between inputs
		//this.INPUT_PADDING_X = 14;

    	// Optional: control statement padding
    	// this.STATEMENT_INPUT_PADDING_LEFT = 150;  // indent statements more or less
    	//this.DUMMY_INPUT_MIN_HEIGHT = 5;        // taller dummy inputs





		
	}

	init() {
		super.init();

		this.RECTANGLE_HORIZONTAL = this.makeSVGPathHorizontal("m 0 0 l -1 0 l 0 1 l 1 0");
		this.RECTANGLE_VERTICAL = this.makeSVGPathVertical("m 0 0 l -1 0 l 0 1 l 1 0");

		this.ROUND_HORIZONTAL = this.makeSVGPathHorizontal(scaleSvgPath(relativizePath("M 0 0 L -2 0 C -3 0 -4 1 -4 2 C -4 3 -3 4 -2 4 L 0 4"), 0.25, 0.25));
		this.ROUND_VERTICAL = this.makeSVGPathVertical(scaleSvgPath(relativizePath("M 0 0 L -2 0 C -3 0 -4 1 -4 2 C -4 3 -3 4 -2 4 L 0 4"), 0.25, 0.25));

		this.OCTOGON_HORIZONTAL = this.makeSVGPathHorizontal(scaleSvgPath(relativizePath("M 0 0 L -2 0 L -4 2 L -4 4 L -2 6 L 0 6"), 1.0/6, 1.0/6));
		this.OCTOGON_VERTICAL = this.makeSVGPathVertical(scaleSvgPath(relativizePath("M 0 0 L -2 0 L -4 2 L -4 4 L -2 6 L 0 6"), 1.0/6, 1.0/6));

		this.NOTCH_HORIZONTAL = this.makeSVGPathHorizontal(scaleSvgPath(relativizePath("M 0 0 L -2 2 L -2 4 L 0 6"), 1.0/2, 1.0/6));
		this.NOTCH_VERTICAL = this.makeSVGPathVertical(scaleSvgPath(relativizePath("M 0 0 L -2 2 L -2 4 L 0 6"), 1.0/2, 1.0/6));

		this.PUZZLE_TAB_HORIZONTAL = this.makeSVGPathHorizontal(scaleSvgPath(relativizePath("M 0 0 L -4 -2 C -5 -1 -6 0 -6 2 C -6 4 -5 5 -4 6 L 0 4"), 1.0/8, 1.0/8));
		this.PUZZLE_TAB_VERTICAL = this.makeSVGPathVertical(scaleSvgPath(relativizePath("M 0 0 L -4 -2 C -5 -1 -6 0 -6 2 C -6 4 -5 5 -4 6 L 0 4"), 1.0/8, 1.0/8));

		this.TECHNIC_PIN = this.makeSVGPathHorizontal(scaleSvgPath(relativizePath(`
			M 0 0 L -3 0 A 1 1 90 0 0 -4 1 L -4 2 L -18 2 A 1 1 90 0 0 -19 1 A 1 1 90 
			0 0 -20 2 L -20 8 A 1 1 90 0 0 -19 9 L -8 9 A 1 1 90 0 1 -8 11 L -19 11 A 
			1 1 90 0 0 -20 12 L -20 18 A 1 1 90 0 0 -19 19 A 1 1 90 0 0 -18 18 L -4 18 L -4 19 A 1 1 90 0 0 -3 20 L 0 20
			`), 1.0/20, 1.0/20));

		this.ARROW = this.makeSVGPathVertical(scaleSvgPath(relativizePath("M 0 0 L -2 0 L -2 -1 L -4 1 L -2 3 L -2 2 L 0 2"), 0.25, 0.25));

		this.TECHNIC_AXLE = this.makeSVGPathHorizontal(scaleSvgPath(relativizePath(`
			M 0 0 L -7 0 L -7 2 L 0 2 L 0 3 L -9 3 L -9 6 L 0 6 L 0 7 L -7 7 L -7 9 L 0 9
			`), 1.0/9, 1.0/9));

		this.TECHNIC_GENERIC = this.makeSVGPathHorizontal(scaleSvgPath(relativizePath("M 0 0 L -7 0 L -9 4 L -9 5 L -7 9 L 0 9"), 1.0/9, 1.0/9));

	}

	shapeFor(connection) {
		var checks = connection.getCheck();
		switch (connection.type) {
			case Blockly.INPUT_VALUE:
			case Blockly.OUTPUT_VALUE:
				if (checks && checks.includes('Number')) {
					return this.RECTANGLE_HORIZONTAL;
				}
				if (checks && checks.includes('String')) {
					return this.ROUND_HORIZONTAL;
				}
				if (checks && checks.includes('Boolean')) {
				    return this.NOTCH_HORIZONTAL;
				}
				return this.ROUND_HORIZONTAL;
			case Blockly.PREVIOUS_STATEMENT:
			case Blockly.NEXT_STATEMENT:
				return this.NOTCH_VERTICAL;
			default:
				throw Error('Unknown connection type');
		}
	}

	/**
	 * Creates a blockly shape object for horizontal connections from svg paths
	 * 
	 * Svg paths should be formatted as follows:
	 * - relative coordinates
	 * - winding counter-clockwise
	 * - start at 0,0
	 * - end at 0,y where y is between 0 and 1
	 * - contained within a 1x1 box in quadrant 3 of the cartesian plane
	 * - NOTE: do not connect the last point to the first point leave it as an open path not a closed shape
	 * - https://yqnn.github.io/svg-path-editor/
	 * 
	 * @param {*} plugPath the svg path for the male end of the connection
	 * @param {*} portPath the svg path for the female end of the connection
	 * @returns blockly shape object
	 */
	makeSVGPathHorizontal(plugPath, portPath = plugPath) {

		const distance = getDistanceBetweenLastAndFirstPoint(portPath)

		const pathDown =  replaceFirstCommand((scaleSvgPath(portPath, this.TAB_WIDTH, this.TAB_HEIGHT))) + ("v" + ((1-distance) * this.TAB_HEIGHT))
		const pathUp = ("v" + (-this.TAB_HEIGHT)) + replaceFirstCommand(scaleSvgPath(relativizePath(reverseSvgPath(plugPath)), this.TAB_WIDTH, this.TAB_HEIGHT))
		return {
			width: this.TAB_WIDTH,
			height: this.TAB_HEIGHT,
			pathUp: pathUp,
			pathDown: pathDown,
		};
	}

	/**
	 * Creates a blockly shape object for vertical connections from svg paths
	 * 
	 * Svg paths should be formatted as follows:
	 * - relative coordinates
	 * - winding counter-clockwise
	 * - start at 0,0
	 * - end at 0,y where y is between 0 and 1
	 * - contained within a 1x1 box in quadrant 3 of the cartesian plane
	 * - NOTE: do not connect the last point to the first point leave it as an open path not a closed shape
	 * - https://yqnn.github.io/svg-path-editor/
	 * 
	 * @param {*} plugPath the svg path for the male end of the connection
	 * @param {*} portPath the svg path for the female end of the connection
	 * @returns blockly shape object
	 */
	makeSVGPathVertical(plugPath, portPath = plugPath) {

		const distancePlug = getDistanceBetweenLastAndFirstPoint(plugPath)
		const distancePort = getDistanceBetweenLastAndFirstPoint(portPath)

		const pathLeft = replaceFirstCommand(scaleSvgPath(rotatePath(portPath, 270), this.NOTCH_WIDTH, this.NOTCH_HEIGHT)) + ("h" + ((1 - distancePort) * this.NOTCH_WIDTH))
		const pathRight = ("h" + ((1 - distancePlug) * -this.NOTCH_WIDTH)) + replaceFirstCommand(removeFirstCommand(scaleSvgPath(relativizePath(reverseSvgPath(rotatePath(plugPath, 270))), this.NOTCH_WIDTH, this.NOTCH_HEIGHT)))
		return {
			width: this.NOTCH_WIDTH,
			height: this.NOTCH_HEIGHT,
			pathLeft: pathLeft,
			pathRight: pathRight,
		};
	}

	

}

function relativizePath(d) {
	const svgPath = new SvgPath(d);
	svgPath.setRelative(true);
	return svgPath.asString();
}

function scaleSvgPath(d, scaleX, scaleY) {
	const svgPath = new SvgPath(d);
	svgPath.scale(scaleX, scaleY);
	return svgPath.asString();
}

function rotatePath(d, angle) {
	const svgPath = new SvgPath(d);
	svgPath.rotate(0,0,angle);
	return svgPath.asString();
}

function reverseSvgPath(d) {
	const svgPath = new SvgPath(d);
	reversePath(svgPath);
	return svgPath.asString();
}

function replaceFirstCommand(d) {
	// blockly doesn't like 'M' commands in the middle of paths
	// remove the first character of the string and replace with 'l' to convert moveto to lineto
	return 'l' + d.slice(d.indexOf(' ') + 1);
}

function removeFirstCommand(d) {
	// the svg editor adds an initial 'M' command to set the origin that we don't want
	const svgPath = new SvgPath(d);
	svgPath.insert(SvgItem.Make(['M', '0', '0']), svgPath.path[0]);
	svgPath.delete(svgPath.path[0]);
	return svgPath.asString();
}

function getDistanceBetweenLastAndFirstPoint(d) {
	const svgPath = new SvgPath(d);
	const points = svgPath.path;
	const firstPoint = points[0].absolutePoints[0];
	const lastPoint = points[points.length - 1].absolutePoints[points[points.length - 1].absolutePoints.length - 1];
	const deltaX = lastPoint.x - firstPoint.x;
	const deltaY = lastPoint.y - firstPoint.y;
	return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
}