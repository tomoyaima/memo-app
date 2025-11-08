import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Home from '../src/routes/Home'
import type { Note } from '../src/db/models'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

const mockCreateNote = vi.fn()
const mockTogglePin = vi.fn()
const mockToggleArchive = vi.fn()

const baseNote = (overrides: Partial<Note>): Note => ({
  id: 'test',
  ownerId: 'owner',
  title: 'title',
  contentHtml: '<p>content</p>',
  tags: [],
  pinned: false,
  updatedAt: Date.now(),
  ...overrides,
})

vi.mock('../src/hooks/useIndexedDB', () => ({
  useNotesContext: () => ({
    notes: [
      baseNote({ id: 'a', title: 'Design system', tags: ['design'], pinned: true }),
      baseNote({ id: 'b', title: 'API Spec', tags: ['api', 'backend'], pinned: false }),
    ],
    createNote: mockCreateNote,
    togglePin: mockTogglePin,
    toggleArchive: mockToggleArchive,
    loading: false,
  }),
}))

describe('Home route', () => {
  beforeEach(() => {
    mockNavigate.mockReset()
    mockCreateNote.mockReset()
  })

  it('filters notes by search input', async () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )
    const searchBox = screen.getByPlaceholderText('全文検索')
    await userEvent.type(searchBox, 'API')
    expect(screen.getByText('API Spec')).toBeInTheDocument()
    expect(screen.queryByText('Design system')).not.toBeInTheDocument()
  })

  it('creates a new note and navigates to detail view', async () => {
    mockCreateNote.mockResolvedValueOnce(baseNote({ id: 'new-id' }))
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )
    await userEvent.click(screen.getByRole('button', { name: '+ 新規メモ' }))
    expect(mockCreateNote).toHaveBeenCalledTimes(1)
    expect(mockNavigate).toHaveBeenCalledWith('/notes/new-id')
  })
})
