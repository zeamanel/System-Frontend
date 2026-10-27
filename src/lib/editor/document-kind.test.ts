import { describe, expect, it } from 'vitest'
import { DesignContentError, documentKindOf, isDesignContent } from './document-kind'
import { deserializeModel, parseDocumentContent } from './model'

const design = { schema: 'docuA4.design', page: { size: 'A4' }, elements: [{ type: 'text', value: 'የምስክር ወረቀት' }] }

describe('document kinds', () => {
  it('recognises design content as a string or an object, and nothing else', () => {
    expect(isDesignContent(JSON.stringify(design))).toBe(true)
    expect(isDesignContent(design)).toBe(true)
    expect(isDesignContent(JSON.stringify({ schema: 'docuA4.document', blocks: [] }))).toBe(false)
    expect(isDesignContent('{"blocks":[]}')).toBe(false)
    expect(isDesignContent('Plain letter text mentioning docuA4.design')).toBe(false)
    expect(isDesignContent(null)).toBe(false)
  })

  it('takes the kind from the record, or from design content on older records', () => {
    expect(documentKindOf({ kind: 'design', content: null })).toBe('design')
    expect(documentKindOf({ content: JSON.stringify(design) })).toBe('design')
    expect(documentKindOf({ kind: 'text', content: '{"blocks":[]}' })).toBe('text')
    expect(documentKindOf({})).toBe('text')
  })

  it('the text editor loader refuses designs instead of converting them', () => {
    expect(() => parseDocumentContent(JSON.stringify(design))).toThrow(DesignContentError)
    expect(() => deserializeModel(design)).toThrow(DesignContentError)
    // Text content is unaffected.
    expect(parseDocumentContent('{"blocks":[{"type":"paragraph","text":"Hi"}]}')?.blocks).toHaveLength(1)
    expect(parseDocumentContent('Plain text')?.blocks.length).toBeGreaterThan(0)
  })
})
