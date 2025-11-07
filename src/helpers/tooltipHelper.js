import { tag } from 'ellipsi'
import { marked } from 'marked'

export { claimTooltip, releaseTooltip, updateTooltip, getOwner }

let CustomTooltip

let tooltipOwner
let tooltipPos
let tooltipContent

export default () => {
    CustomTooltip = tag('custom-tooltip')
    return CustomTooltip
}

function claimTooltip(owner, pos, text) {
    if (tooltipOwner != owner) {
        releaseTooltip(tooltipOwner)
        tooltipOwner = owner
    }
    CustomTooltip.style.display = 'block'
    if (pos != null) {
        tooltipPos = pos
        CustomTooltip.style.left = pos.x + 10 + 'px'
        CustomTooltip.style.top = pos.y + 10 + 'px'
    }
    if (text != null) {
        tooltipContent = CustomTooltip.innerHTML = marked.parse(text)
    }
}

function updateTooltip(owner, pos, text) {
    if (tooltipOwner == owner) {
        tooltipPos = pos
        tooltipContent = CustomTooltip.innerHTML = marked.parse(text)
        CustomTooltip.style.display = 'block'
        CustomTooltip.style.left = pos.x + 10 + 'px'
        CustomTooltip.style.top = pos.y + 10 + 'px'
    }
}

function releaseTooltip(owner) {
    if (tooltipOwner == owner) {
        CustomTooltip.style.display = 'none'
        tooltipOwner = null
    }
}

function getOwner() {
    return tooltipOwner
}
