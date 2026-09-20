import * as Blockly from 'blockly';
import { ProtoRenderer } from "./proto_renderer/proto_renderer.js";

/** Injects all of our custom blockly modifications */
export function injectMods(){
    Blockly.blockRendering.register('proto_renderer', ProtoRenderer);
}
