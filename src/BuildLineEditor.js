import { tag } from 'ellipsi'

import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { basicSetup} from "codemirror"
import {python} from "@codemirror/lang-python"
import { oneDark } from '@codemirror/theme-one-dark';
import {autocompletion, completeFromList } from "@codemirror/autocomplete"
import {defaultKeymap, indentWithTab } from "@codemirror/commands"
import { hoverTooltip } from "@codemirror/view";

import {showTooltip, moveTooltip, hideTooltip} from './main'
import { functionVocab } from './vocab';

export default (vocab) => {
    const LineEditor = tag('line-editor',
        'line',
    )

    const completions = [
    ];

    for (const key in functionVocab) {
      const entry = functionVocab[key];
      console.log(entry.type);
      completions.push({ label: key, type: entry.type, info: entry.description },)
    }
    let lastHoverRange = null;

    function functionInfoTooltip(view, pos) {
      const word = view.state.wordAt(pos);
      if (!word) {
        lastHoverRange = null;
        return null;
      }
    
      const hoveredText = view.state.sliceDoc(word.from, word.to);
    
      const found = completions.find(
        c => c.label === hoveredText || c.label.endsWith('.' + hoveredText)
      );
      if (!found) {
        lastHoverRange = null;
        return null;
      }
    
      lastHoverRange = { from: word.from, to: word.to };
    
      showTooltip(
        { x: view.coordsAtPos(pos).left, y: view.coordsAtPos(pos).top },
        found.info
      );
    }

    const hoverExtension = hoverTooltip(functionInfoTooltip);

    const view = new EditorView({
        state: EditorState.create({
      doc: "import make\n\n",
      extensions: [basicSetup, python(), oneDark,       autocompletion({
            override: [completeFromList(completions)]
          }), hoverExtension, keymap.of([defaultKeymap, indentWithTab])],
        }),
      parent: LineEditor
    })

    view.dom.addEventListener('mousemove', (ev) => {
      if (!lastHoverRange) return;
    
      const coords = { x: ev.clientX, y: ev.clientY };
      const pos = view.posAtCoords(coords);
    
      const outsideRange =
        pos === null ||
        pos < lastHoverRange.from ||
        pos > lastHoverRange.to;
    
      if (outsideRange) {
        hideTooltip();
      
        lastHoverRange = null;
        lastHoverText  = null;
      }
    });

    const code = view.state.doc.toString();
    console.log(code);

    function setEditorText(view, text) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
    }

    setEditorText(view, "import make" + "\n" +
    "# name your motors!" + "\n" +
    "left = make.largemotor(6)" + "\n" +
    "right = make.largemotor(7)" + "\n" + "\n" +

    "# spin both motors forwards" + "\n" +
    "left.spin(100)" + "\n" +
    "right.spin(100)" + "\n" +
    "# wait for 2 seconds" + "\n" +
    "make.wait(2)" + "\n" +
    "# stop both motors" + "\n" +
    "left.stop()" + "\n" +
    "right.stop()") // TODO use this method to load the code from the python file

    if (LineEditor) {
        LineEditor.addEventListener("click", () => {
            view.focus();
        });
    } else {
        console.error("Could not find code editor container or input element.");
    }

    return LineEditor
}
