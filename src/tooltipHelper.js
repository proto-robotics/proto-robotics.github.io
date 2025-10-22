import { tag } from 'ellipsi'
import { marked } from 'marked'

export { claimTooltip, releaseTooltip, updateTooltip, getOwner }

let customTooltip

let tooltipOwner
let tooltipPos
let tooltipContent

export default () => {
    customTooltip = tag('custom-tooltip')
    return customTooltip
}

function claimTooltip(owner, pos, text) {
    if (tooltipOwner != owner) {
        releaseTooltip(tooltipOwner)
        tooltipOwner = owner
    }
    customTooltip.style.display = 'block'
    if (pos != null) {
        tooltipPos = pos
        customTooltip.style.left = pos.x + 10 + 'px'
        customTooltip.style.top = pos.y + 10 + 'px'
    }
    if (text != null) {
        tooltipContent = customTooltip.innerHTML = marked.parse(text)
    }
}

function updateTooltip(owner, pos, text) {
    if (tooltipOwner == owner) {
        tooltipPos = pos
        tooltipContent = customTooltip.innerHTML = marked.parse(text)
        customTooltip.style.display = 'block'
        customTooltip.style.left = pos.x + 10 + 'px'
        customTooltip.style.top = pos.y + 10 + 'px'
    }
}

function releaseTooltip(owner) {
    if (tooltipOwner == owner) {
        customTooltip.style.display = 'none'
        tooltipOwner = null
    }
}

function getOwner() {
    return tooltipOwner
}
