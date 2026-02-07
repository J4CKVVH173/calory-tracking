'use client'

import React from "react"

/**
 * Simple Markdown renderer that handles common formatting
 * without the react-markdown dependency (which causes CSS conflicts).
 */
export function SimpleMarkdown({ content }: { content: string }) {
  const lines = content.split('\n')

  const elements: React.ReactNode[] = []
  let listItems: string[] = []
  let listType: 'ul' | 'ol' | null = null
  let listKey = 0

  function flushList() {
    if (listItems.length === 0 || !listType) return
    const Tag = listType
    const className =
      listType === 'ul' ? 'list-disc pl-5 my-2 space-y-1' : 'list-decimal pl-5 my-2 space-y-1'
    elements.push(
      <Tag key={`list-${listKey++}`} className={className}>
        {listItems.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </Tag>,
    )
    listItems = []
    listType = null
  }

  function renderInline(text: string): React.ReactNode {
    // Process bold, italic, inline code
    const parts: React.ReactNode[] = []
    // Regex: **bold**, *italic*, `code`
    const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g
    let lastIndex = 0
    let match: RegExpExecArray | null = null

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index))
      }
      if (match[2]) {
        // **bold**
        parts.push(
          <strong key={match.index} className="font-semibold">
            {match[2]}
          </strong>,
        )
      } else if (match[3]) {
        // *italic*
        parts.push(
          <em key={match.index} className="italic">
            {match[3]}
          </em>,
        )
      } else if (match[4]) {
        // `code`
        parts.push(
          <code
            key={match.index}
            className="bg-muted px-1 py-0.5 rounded text-sm font-mono"
          >
            {match[4]}
          </code>,
        )
      }
      lastIndex = match.index + match[0].length
    }

    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex))
    }

    return parts.length === 1 ? parts[0] : <>{parts}</>
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // Empty line
    if (!trimmed) {
      flushList()
      continue
    }

    // Headings
    if (trimmed.startsWith('### ')) {
      flushList()
      elements.push(
        <h3 key={i} className="text-base font-semibold mt-4 mb-1">
          {renderInline(trimmed.slice(4))}
        </h3>,
      )
      continue
    }
    if (trimmed.startsWith('## ')) {
      flushList()
      elements.push(
        <h2 key={i} className="text-lg font-semibold mt-4 mb-1">
          {renderInline(trimmed.slice(3))}
        </h2>,
      )
      continue
    }
    if (trimmed.startsWith('# ')) {
      flushList()
      elements.push(
        <h1 key={i} className="text-xl font-bold mt-4 mb-2">
          {renderInline(trimmed.slice(2))}
        </h1>,
      )
      continue
    }

    // Unordered list
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (listType === 'ol') flushList()
      listType = 'ul'
      listItems.push(trimmed.slice(2))
      continue
    }

    // Ordered list
    const olMatch = trimmed.match(/^(\d+)\.\s+(.+)$/)
    if (olMatch) {
      if (listType === 'ul') flushList()
      listType = 'ol'
      listItems.push(olMatch[2])
      continue
    }

    // Horizontal rule
    if (/^[-*_]{3,}$/.test(trimmed)) {
      flushList()
      elements.push(<hr key={i} className="my-3 border-border" />)
      continue
    }

    // Regular paragraph
    flushList()
    elements.push(
      <p key={i} className="my-1.5 leading-relaxed">
        {renderInline(trimmed)}
      </p>,
    )
  }

  flushList()

  return <div className="text-sm space-y-0">{elements}</div>
}
