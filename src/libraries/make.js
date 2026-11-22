/*
 * The make blocks: the real robot's own, which a sandbox has no part for.
 * The board's lights now; later its sensors and servos.
 */
import { categoryIcon } from '../assets'
import {
    gridDropdown,
    text,
    field,
    num,
    val,
    lights,
    boardPart,
    block,
} from './kit'

/** @type {import('./engine').Library} */
export const make = {
    name: 'make',
    /** Its programs are for the real robot: the editor gets Send to Brain. */
    brain: true,
    categories: [
        {
            name: 'Board',
            color: '#6395CF',
            icon: categoryIcon('board'),
            entries: [
                block(
                    'lightSet',
                    "Turns one of the board's lights on or off, or the other way round with toggle.",
                    [
                        text('Light'),
                        field('light', () => gridDropdown(lights)),
                        field('action', () =>
                            gridDropdown([
                                ['on', 'on'],
                                ['off', 'off'],
                                ['toggle', 'toggle'],
                            ]),
                        ),
                    ],
                    (b, g) =>
                        `${boardPart(b, 'light')}.${b.getFieldValue('action')}()\n`,
                ),
                block(
                    'lightFlash',
                    'Turns a light on and off again after some seconds, without waiting: the program goes straight on.',
                    [
                        text('Flash'),
                        field('light', () => gridDropdown(lights)),
                        text('for'),
                        num('time', 0.2),
                        text('seconds'),
                    ],
                    (b, g) =>
                        `${boardPart(b, 'light')}.flash(seconds=${val(b, 'time')})\n`,
                ),
            ],
        },
    ],
    lint: {
        zeroTime: {
            lightFlash: 'A 0 second flash is too short to see. Try 0.2 seconds.',
        },
    },
}
