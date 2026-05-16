import { Schema } from 'prosemirror-model'
import { defaultMarkdownSerializer } from 'prosemirror-markdown'

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { content: 'inline*', group: 'block', toDOM: () => ['p', 0], parseDOM: [{tag:'p'}] },
    text: { group: 'inline' }
  },
  marks: {
    code: { toDOM: () => ['code', 0], parseDOM: [{tag:'code'}] }
  }
})

const codeMark = schema.marks.code
const para = schema.nodes.paragraph.create(null, [
  schema.text('before '),
  schema.text('{nome: Luiz}', [codeMark.create()]),
  schema.text(' after'),
])
const doc = schema.nodes.doc.create(null, [para])

const md = defaultMarkdownSerializer.serialize(doc)
console.log('Serialized:')
console.log(JSON.stringify(md))
console.log('---raw---')
console.log(md)
