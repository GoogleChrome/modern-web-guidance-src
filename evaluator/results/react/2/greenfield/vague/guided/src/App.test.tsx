import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import App from './App'
import React from 'react'

// Mock Polyfills and APIs that might not exist in JSDOM/HappyDOM
global.IntersectionObserver = class IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = '';
  readonly thresholds: ReadonlyArray<number> = [];

  constructor() { }

  observe() { }
  unobserve() { }
  disconnect() { }
  takeRecords() { return [] }
} as any;

describe('App', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders the hero section', () => {
    render(<App />)
    expect(screen.getByText(/Brewed to Perfection/i)).toBeTruthy()
  })

  it('renders the order button', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: /Order Now/i })).toBeTruthy()
  })

  it('renders product details', () => {
    render(<App />)
    const elements = screen.getAllByText(/Signature Espresso Blend/i)
    expect(elements.length).toBeGreaterThan(0)
  })
})
