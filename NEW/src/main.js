import { process } from "@protorobotics/jenga";
import { definitions } from "./blocks";
import { pythonGenerator } from "blockly/python";

const toolbox = process(definitions, pythonGenerator)