import { describe, expect, it } from 'vitest'
import { ownsKeyboard } from './keyboardTarget'

function mount(html: string): HTMLElement {
  const root = document.createElement('div')
  root.innerHTML = html
  document.body.appendChild(root)
  return root
}

describe('ownsKeyboard', () => {
  it('fields keep their keys, arrows included', () => {
    const root = mount('<input id="i"><textarea id="t"></textarea><select id="s"><option>a</option></select>')
    for (const id of ['i', 't', 's']) expect(ownsKeyboard(root.querySelector(`#${id}`)), id).toBe(true)
  })

  it('editable text keeps its keys, also on a child of it', () => {
    const root = mount('<div contenteditable="true"><p id="p">texto</p></div>')
    expect(ownsKeyboard(root.querySelector('#p'))).toBe(true)
  })

  it('a button inside a modal keeps Space and the arrows', () => {
    const root = mount('<div aria-modal="true" role="dialog"><button id="b">Test voice</button></div>')
    expect(ownsKeyboard(root.querySelector('#b'))).toBe(true)
  })

  it('the page, the toolbar and the player do not own the keyboard', () => {
    const root = mount('<div id="page"><button id="b">Copy</button></div><body-like id="x"></body-like>')
    expect(ownsKeyboard(root.querySelector('#b'))).toBe(false)
    expect(ownsKeyboard(root.querySelector('#page'))).toBe(false)
    expect(ownsKeyboard(document.body)).toBe(false)
    expect(ownsKeyboard(null)).toBe(false)
    expect(ownsKeyboard(window)).toBe(false)
  })
})
