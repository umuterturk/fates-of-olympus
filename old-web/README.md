# Fates of Olympus - Web Version

A React + TypeScript implementation of the Fates of Olympus card game.

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Framer Motion** - Animations
- **Zustand** - State management

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Type check
npm run typecheck

# Build for production
npm run build
```

## Project Structure

```
src/
├── engine/          # TypeScript port of Python game engine
├── components/      # React components
│   └── game/        # Game-specific components (Card, Board, etc.)
├── hooks/           # Custom React hooks
├── store/           # Zustand state stores
├── pages/           # Page components
└── styles/          # Global styles
```

## Development Phases

See [PLAN.md](./PLAN.md) for the detailed development plan.

### Current Status

- [x] Project setup
- [x] Core types ported
- [x] Basic components created
- [ ] Complete engine port
- [ ] Game loop implementation
- [ ] Animations
- [ ] NPC AI
- [ ] Firebase integration
- [ ] Multiplayer

## Animation System

This project uses **Framer Motion** for animations:

- **Layout animations** - Cards automatically animate when moving between locations
- **AnimatePresence** - Smooth enter/exit for cards
- **Gestures** - Drag-and-drop for playing cards
- **Orchestration** - Sequence animations for game events

Example:
```tsx
<motion.div
  layout
  layoutId={`card-${card.instanceId}`}
  initial={{ scale: 0 }}
  animate={{ scale: 1 }}
  exit={{ scale: 0 }}
>
  <Card card={card} />
</motion.div>
```

## License

Private - All rights reserved.
