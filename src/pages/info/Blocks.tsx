import { renderInline } from '../../content/info/inline'
import type { InlineContext } from '../../content/info/inline'
import type { Block } from '../../content/info/types'

/** Paragraphs, lists and tables of an info page, with [[tokens]] resolved. */
export function Blocks({ blocks, context }: { blocks: Block[]; context: InlineContext }) {
  return (
    <>
      {blocks.map((block, index) => {
        if (block.type === 'p') return <p key={index}>{renderInline(block.text, context)}</p>
        if (block.type === 'ul') {
          return (
            <ul key={index}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInline(item, context)}</li>
              ))}
            </ul>
          )
        }
        return (
          <div key={index} className="info-table-wrap">
            <table className="info-table">
              <thead>
                <tr>
                  {block.head.map((cell, cellIndex) => (
                    <th key={cellIndex} scope="col">
                      {renderInline(cell, context)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) =>
                      cellIndex === 0 ? (
                        <th key={cellIndex} scope="row">
                          {renderInline(cell, context)}
                        </th>
                      ) : (
                        <td key={cellIndex}>{renderInline(cell, context)}</td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}
    </>
  )
}
