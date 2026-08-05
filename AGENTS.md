# Frontend

This directory contains the entire NeuroFlow frontend application.

The frontend is the heart of NeuroFlow.

More than simply displaying information, it delivers an immersive experience designed to help users achieve deep focus, relaxation, and better sleep.

Every interface should feel handcrafted. Every interaction should feel intentional. Every animation should serve a purpose.

The quality of the user experience is one of NeuroFlow's greatest differentiators and must never be compromised.

---

# Stack

## Framework

- Vue.js

## Tooling

- Vite
- Vue Router
- Pinia
- Vue I18n

## UI

- Tailwind CSS
- PrimeVue

---

# Vision

NeuroFlow is not a dashboard.

It is not a CRUD application.

It is a premium consumer product built around immersion, focus, and beautiful design.

The goal is to create an interface that feels calm, elegant, modern, and delightful to use.

Every contribution should make the product feel more polished than before.

---

# User Experience Standards

User experience always comes first.

When making implementation decisions, prioritize:

- Clarity
- Simplicity
- Responsiveness
- Accessibility
- Fluidity
- Delight

A feature is **not complete** simply because it works.

It is only complete when it also feels intuitive, polished, and enjoyable to use.

---

# Design Philosophy

Design is not decoration.

Design is part of the product.

Every screen should communicate:

- Calmness
- Focus
- Sophistication
- Depth
- Precision

Avoid interfaces that feel:

- Generic
- Corporate
- Template-based
- Cluttered
- Visually noisy

The application should never resemble a traditional admin panel.

Instead, it should feel closer to products like Brain.fm, Arc Browser, Linear, Raycast, or Notion: clean, modern, immersive, and thoughtfully crafted.

---

# Visual Identity

Always preserve NeuroFlow's visual identity.

The interface should emphasize:

- Soft gradients
- Layered depth
- Rounded corners
- Clean typography
- Consistent spacing
- Subtle borders
- Soft shadows
- High-quality visual hierarchy

Accent colors should be used intentionally to guide attention—not to decorate the interface.

Whitespace is an essential design element.

Do not overcrowd layouts.

---

# Motion Design

Motion is part of the interface.

Animations should:

- Guide attention.
- Reinforce hierarchy.
- Improve perceived performance.
- Make interactions feel natural.

Prefer:

- Smooth transitions
- Fade animations
- Gentle scaling
- Soft hover effects
- Meaningful micro-interactions

Avoid:

- Abrupt transitions.
- Flashy animations.
- Excessive movement.
- Motion without purpose.

Subtle motion is almost always better than excessive motion.

---

# PrimeVue

PrimeVue is a foundation—not the final design.

Never rely on the default PrimeVue appearance.

PrimeVue components should always be customized to match NeuroFlow's design language.

The visual identity of the application must come from NeuroFlow, not from the component library.

---

# Tailwind CSS

Tailwind CSS is the primary styling solution.

Prefer:

- Utility classes
- Reusable design patterns
- Consistent spacing
- Design tokens when available

Avoid:

- Inline styles
- Duplicated utility combinations
- Inconsistent spacing
- Arbitrary values without justification

---

# Components

Before creating a new component:

1. Check whether a similar component already exists.
2. Reuse existing components whenever possible.
3. Prefer composition over duplication.

Components should:

- Have a single responsibility.
- Be reusable.
- Be easy to understand.
- Be easy to maintain.
- Be visually consistent.

Avoid:

- Massive components.
- Deep prop drilling.
- Repeated UI patterns.
- Unnecessary abstractions.

---

# State Management

Use Pinia only for shared application state.

Avoid storing temporary UI state globally.

Keep stores:

- Small
- Focused
- Predictable

---

# Routing

Use Vue Router with a clear and predictable structure.

Lazy-load pages whenever appropriate.

Keep routes organized and maintainable.

---

# Internationalization

Every user-facing string must use Vue I18n.

Never hardcode text inside components.

Every new feature must include translations.

---

# Accessibility

Accessibility is part of quality.

Always consider:

- Keyboard navigation
- Focus visibility
- Screen readers
- Semantic HTML
- Color contrast

Beautiful interfaces should also be accessible.

---

# Performance

Beautiful interfaces must also be fast.

Always consider:

- Bundle size
- Rendering performance
- Lazy loading
- Code splitting
- Component reuse

Do not sacrifice responsiveness for visual effects.

---

# Code Standards

Always use:

- Vue 3 Composition API
- `<script setup>`
- Reusable composables
- Small components
- Clear naming
- DRY principles
- SOLID principles where appropriate

Avoid:

- Business logic inside components.
- Large monolithic components.
- Duplicated logic.
- Unnecessary complexity.

---

# Before Modifying an Existing Screen

Before making UI changes:

- Study the existing interface.
- Preserve the current design language.
- Match typography.
- Match spacing.
- Match colors.
- Match proportions.
- Match animations.
- Reuse existing visual patterns.

Never introduce a new visual style unless explicitly requested.

Consistency is more important than novelty.

---

# Definition of Done

A frontend task is only considered complete when:

- The feature works correctly.
- The interface feels premium.
- The UI is visually polished.
- The UX is intuitive.
- Animations are smooth.
- Responsiveness is preserved.
- Accessibility has been considered.
- Performance remains excellent.
- The implementation is consistent with the rest of the application.

---

# AI Agent Guidelines

When contributing to NeuroFlow:

- Think like a product designer, not just a software engineer.
- Respect the existing visual identity.
- Prioritize user experience over implementation speed.
- Never sacrifice design quality for convenience.
- Reuse existing patterns whenever possible.
- Do not redesign existing interfaces unless explicitly requested.
- Keep interactions smooth, modern, and immersive.
- Every pixel should feel intentional.
- Every animation should have a purpose.
- Every component should contribute to a cohesive user experience.

When in doubt, choose the solution that creates the best experience for the user while keeping the codebase clean, maintainable, and consistent.