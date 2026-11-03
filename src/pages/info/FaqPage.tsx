import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { env } from '../../config/env'
import { FAQ } from '../../content/info/faq'
import { plainText, renderInline } from '../../content/info/inline'
import type { Block } from '../../content/info/types'
import { useI18n } from '../../i18n'
import { SearchInput } from '../../components/ui'
import { Blocks } from './Blocks'
import { InfoLayout } from './InfoLayout'
import { useInlineContext } from './use-inline-context'

function blockText(blocks: Block[]): string {
  return blocks
    .map((block) => (block.type === 'p' ? block.text : block.type === 'ul' ? block.items.join(' ') : ''))
    .join(' ')
}

export default function FaqPage() {
  const { t, locale } = useI18n()
  const context = useInlineContext()
  const { hash } = useLocation()
  const groups = FAQ[locale] ?? FAQ.en
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set())
  const needle = query.trim().toLowerCase()

  // /faq#payments opens that question.
  useEffect(() => {
    const id = decodeURIComponent(hash.slice(1))
    if (id && groups.some((group) => group.items.some((item) => item.id === id))) {
      setOpen((previous) => new Set(previous).add(id))
    }
  }, [hash, groups])

  const visible = useMemo(() => {
    const searchable = (text: string) => plainText(text, context).toLowerCase()
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) => !needle || searchable(item.q).includes(needle) || searchable(blockText(item.a)).includes(needle),
        ),
      }))
      .filter((group) => group.items.length > 0)
  }, [groups, needle, context])

  const total = groups.reduce((sum, group) => sum + group.items.length, 0)
  const shown = visible.reduce((sum, group) => sum + group.items.length, 0)
  const title = t('info.faq.title')

  return (
    <InfoLayout title={title}>
      <article className="info-page">
        <h1 className="info-page__title">{title}</h1>
        <p className="info-page__lead">{t('info.faq.lead', { app: env.appName })}</p>
        <div className="info-faq__search">
          <SearchInput
            id="faq-search"
            value={query}
            onChange={setQuery}
            placeholder={t('info.faq.search')}
            ariaLabel={t('info.faq.search')}
            clearLabel={t('info.faq.clear')}
          />
          {needle ? (
            <p className="info-faq__count" role="status">
              {t('info.faq.results', { count: shown, total })}
            </p>
          ) : null}
        </div>

        {shown === 0 ? (
          <p className="info-faq__none" role="status">
            {t('info.faq.none', { query: query.trim() })}
          </p>
        ) : (
          visible.map((group) => (
            <section key={group.id} id={`group-${group.id}`} className="info-faq__group" aria-labelledby={`group-${group.id}-title`}>
              <h2 id={`group-${group.id}-title`}>{group.title}</h2>
              {group.items.map((item) => (
                <details
                  key={item.id}
                  id={item.id}
                  className="info-faq__item"
                  open={Boolean(needle) || open.has(item.id)}
                  onToggle={(event) => {
                    const isOpen = event.currentTarget.open
                    setOpen((previous) => {
                      if (previous.has(item.id) === isOpen) return previous
                      const next = new Set(previous)
                      if (isOpen) next.add(item.id)
                      else next.delete(item.id)
                      return next
                    })
                  }}
                >
                  <summary>{renderInline(item.q, context)}</summary>
                  <div className="info-faq__answer">
                    <Blocks blocks={item.a} context={context} />
                  </div>
                </details>
              ))}
            </section>
          ))
        )}
      </article>
    </InfoLayout>
  )
}
