import * as Blockly from 'blockly';
import { SvgPath, reversePath, SvgItem } from 'svg-path-editor-lib';

/**
 * PROTO renderer implementation.
 *
 * See README.md in this directory for guidance on the available Blockly
 * renderer extension points.
 */

/** Blockly renderer that supplies PROTO-specific connection shapes. */
export class ProtoRenderer extends Blockly.blockRendering.Renderer {
	constructor() {
		super();
	}

	/** @returns {ProtoRendererConstantProvider} Renderer constants and shapes. */
	makeConstants_() {
		return new ProtoRendererConstantProvider();
	}
}

/** Defines PROTO typography and SVG connection geometry. */
export class ProtoRendererConstantProvider extends Blockly.blockRendering.ConstantProvider {

	/** Font size used by Blockly fields. */
	FIELD_TEXT_FONTSIZE = 10;
	/** Font family loaded by the website stylesheet. */
	FIELD_TEXT_FONTFAMILY = 'Montserrat, sans-serif';

	constructor() {
		super();
	}

	/** Initializes normalized SVG shapes after Blockly calculates base sizes. */
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

	/**
	 * Chooses a connection shape from the connection type and type checks.
	 * @param {Blockly.RenderedConnection} connection Blockly connection.
	 * @returns {object} Blockly connection shape.
	 */
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
	 * @param {string} plugPath SVG path for the male connection.
	 * @param {string} portPath SVG path for the female connection.
	 * @returns {object} Blockly horizontal connection shape.
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
	 * @param {string} plugPath SVG path for the male connection.
	 * @param {string} portPath SVG path for the female connection.
	 * @returns {object} Blockly vertical connection shape.
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

/** @param {string} d SVG path. @returns {string} Relative SVG path. */
function relativizePath(d) {
	const svgPath = new SvgPath(d);
	svgPath.setRelative(true);
	return svgPath.asString();
}

/**
 * @param {string} d SVG path.
 * @param {number} scaleX Horizontal scale.
 * @param {number} scaleY Vertical scale.
 * @returns {string} Scaled SVG path.
 */
function scaleSvgPath(d, scaleX, scaleY) {
	const svgPath = new SvgPath(d);
	svgPath.scale(scaleX, scaleY);
	return svgPath.asString();
}

/**
 * @param {string} d SVG path.
 * @param {number} angle Rotation in degrees.
 * @returns {string} Rotated SVG path.
 */
function rotatePath(d, angle) {
	const svgPath = new SvgPath(d);
	svgPath.rotate(0,0,angle);
	return svgPath.asString();
}

/** @param {string} d SVG path. @returns {string} Reversed SVG path. */
function reverseSvgPath(d) {
	const svgPath = new SvgPath(d);
	reversePath(svgPath);
	return svgPath.asString();
}

/**
 * Replaces the first move command with a line command for path concatenation.
 * @param {string} d SVG path.
 * @returns {string} Path beginning with a relative line command.
 */
function replaceFirstCommand(d) {
	// blockly doesn't like 'M' commands in the middle of paths
	// remove the first character of the string and replace with 'l' to convert moveto to lineto
	return 'l' + d.slice(d.indexOf(' ') + 1);
}

/**
 * Removes the SVG editor's initial origin command.
 * @param {string} d SVG path.
 * @returns {string} Path without the initial origin command.
 */
function removeFirstCommand(d) {
	// the svg editor adds an initial 'M' command to set the origin that we don't want
	const svgPath = new SvgPath(d);
	svgPath.insert(SvgItem.Make(['M', '0', '0']), svgPath.path[0]);
	svgPath.delete(svgPath.path[0]);
	return svgPath.asString();
}

/**
 * Measures the straight-line distance between an SVG path's endpoints.
 * @param {string} d SVG path.
 * @returns {number} Endpoint distance.
 */
function getDistanceBetweenLastAndFirstPoint(d) {
	const svgPath = new SvgPath(d);
	const points = svgPath.path;
	const firstPoint = points[0].absolutePoints[0];
	const lastPoint = points[points.length - 1].absolutePoints[points[points.length - 1].absolutePoints.length - 1];
	const deltaX = lastPoint.x - firstPoint.x;
	const deltaY = lastPoint.y - firstPoint.y;
	return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
}
