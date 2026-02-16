import * as Blockly from 'blockly';
import { ProtoRenderer } from "./proto_renderer/proto_renderer.js";

export function injectMods(){
    Blockly.blockRendering.register('proto_renderer', ProtoRenderer);
}