# Fates of Olympus - Web Version Development Plan

## Overview

Convert the Python card game engine to a React + TypeScript web application with:
- Single-player mode against NPC (greedy AI)
- Future multiplayer support via Firebase
- Smooth card animations using Framer Motion

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Framework** | React 18 + TypeScript | Type safety, component model |
| **Build Tool** | Vite | Fast dev server, optimal builds |
| **Styling** | Tailwind CSS | Rapid UI development |
| **Animations** | Framer Motion | Best-in-class layout animations |
| **State** | Zustand | Simple, TypeScript-friendly |
| **Backend (Phase 2)** | Firebase | Auth, Firestore, Cloud Functions |
| **Testing** | Vitest + React Testing Library | Fast, Vite-native |

---

## Why Framer Motion for Animations?

Framer Motion is ideal for card games because:

1. **Layout Animations** - Cards automatically animate when moving between locations
   ```tsx
   <motion.div layout layoutId={`card-${card.instanceId}`}>
     <Card card={card} />
   </motion.div>
   ```

2. **AnimatePresence** - Smooth enter/exit for cards being played or destroyed
   ```tsx
   <AnimatePresence>
     {cards.map(card => (
       <motion.div
         key={card.instanceId}
         initial={{ scale: 0, opacity: 0 }}
         animate={{ scale: 1, opacity: 1 }}
         exit={{ scale: 0, opacity: 0 }}
       />
     ))}
   </AnimatePresence>
   ```

3. **Drag Gestures** - Native drag-and-drop for playing cards
   ```tsx
   <motion.div
     drag
     dragConstraints={boardRef}
     onDragEnd={(e, info) => handleCardDrop(card, info)}
   />
   ```

4. **Orchestration** - Sequence animations for reveals, power changes
   ```tsx
   const sequence = async () => {
     await animateReveal();
     await animatePowerChange();
     await animateOngoingEffects();
   };
   ```

---

## Project Structure

```
web/
├── src/
│   ├── engine/              # TypeScript port of Python engine
│   │   ├── types.ts         # Type definitions (CardId, PlayerId, etc.)
│   │   ├── models.ts        # CardDef, CardInstance, GameState, etc.
│   │   ├── effects.ts       # Effect primitives
│   │   ├── rules.ts         # Validation, resolution
│   │   ├── controller.ts    # GameController
│   │   └── cards.ts         # Card definitions
│   │
│   ├── ai/                  # NPC logic
│   │   └── greedy.ts        # Greedy algorithm AI
│   │
│   ├── components/          # React components
│   │   ├── game/
│   │   │   ├── Board.tsx           # 3 locations layout
│   │   │   ├── Location.tsx        # Single location with cards
│   │   │   ├── Card.tsx            # Card display
│   │   │   ├── CardStack.tsx       # Cards at a location
│   │   │   ├── Hand.tsx            # Player's hand
│   │   │   ├── EnergyDisplay.tsx   # Energy counter
│   │   │   └── PowerDisplay.tsx    # Location power totals
│   │   │
│   │   ├── animations/
│   │   │   ├── CardReveal.tsx      # Flip animation
│   │   │   ├── PowerChange.tsx     # +/- power indicator
│   │   │   ├── CardMove.tsx        # Move between locations
│   │   │   └── EventSequencer.tsx  # Orchestrates event animations
│   │   │
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── Modal.tsx
│   │       └── Tooltip.tsx
│   │
│   ├── hooks/               # Custom React hooks
│   │   ├── useGame.ts       # Game state management
│   │   ├── useAnimations.ts # Animation sequencing
│   │   └── useDragDrop.ts   # Card drag handling
│   │
│   ├── store/               # Zustand stores
│   │   ├── gameStore.ts     # Game state
│   │   └── uiStore.ts       # UI state (selected card, etc.)
│   │
│   ├── pages/
│   │   ├── Home.tsx         # Main menu
│   │   ├── Game.tsx         # Game screen
│   │   └── GameOver.tsx     # Results screen
│   │
│   ├── styles/
│   │   └── globals.css      # Tailwind + custom styles
│   │
│   ├── App.tsx
│   └── main.tsx
│
├── public/
│   └── cards/               # Card art (placeholder for now)
│
├── index.html
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── vite.config.ts
└── README.md
```

---

## Phase 1: Engine Port + Core UI (Week 1-2)

### 1.1 TypeScript Engine Port

Port each Python module to TypeScript:

| Python File | TypeScript File | Key Changes |
|-------------|-----------------|-------------|
| `types.py` | `types.ts` | `NewType` → type aliases, Enums stay similar |
| `models.py` | `models.ts` | `@dataclass(frozen=True)` → interfaces + helper functions |
| `effects.py` | `effects.ts` | Discriminated unions for Effect type |
| `rules.py` | `rules.ts` | Pattern matching → switch statements |
| `controller.py` | `controller.ts` | Nearly identical structure |
| `cards.py` | `cards.ts` | Import from cards.json |
| `events.py` | `events.ts` | Discriminated unions for Event type |

**Key principle**: Immutable updates via spread operator, not mutation.

```typescript
// Example: Python to TypeScript
// Python:
def with_player(self, player_id: PlayerId, player: PlayerState) -> GameState:
    new_players = list(self.players)
    new_players[player_id] = player
    return GameState(..., players=(new_players[0], new_players[1]))

// TypeScript:
function withPlayer(state: GameState, playerId: 0 | 1, player: PlayerState): GameState {
  const players: [PlayerState, PlayerState] = [...state.players];
  players[playerId] = player;
  return { ...state, players };
}
```

### 1.2 Core UI Components

Build static components first (no animations):

1. **Card.tsx** - Display card with name, cost, power, ability text
2. **Location.tsx** - Show cards for both players, power totals
3. **Board.tsx** - 3 locations in a row
4. **Hand.tsx** - Draggable cards at bottom of screen
5. **EnergyDisplay.tsx** - Current/max energy

### 1.3 Game Loop

Implement basic turn flow:
1. Display game state
2. Player selects card + location
3. Submit action
4. NPC computes action (greedy)
5. Resolve turn
6. Update display
7. Repeat until game over

---

## Phase 2: Animations (Week 2-3)

### 2.1 Animation System Architecture

```typescript
// Animation queue processes events sequentially
interface AnimationQueue {
  events: GameEvent[];
  currentIndex: number;
  isPlaying: boolean;
}

// Each event type maps to an animation
const eventAnimations: Record<GameEvent['type'], AnimationConfig> = {
  CardPlayed: { duration: 0.3, type: 'move' },
  CardRevealed: { duration: 0.5, type: 'flip' },
  PowerChanged: { duration: 0.4, type: 'pulse' },
  CardMoved: { duration: 0.6, type: 'move' },
  CardDestroyed: { duration: 0.5, type: 'fade' },
};
```

### 2.2 Key Animations

| Animation | Trigger | Framer Motion Approach |
|-----------|---------|------------------------|
| **Card Play** | `CardPlayedEvent` | `layout` + `layoutId` for automatic position animation |
| **Card Reveal** | `CardRevealedEvent` | 3D flip with `rotateY` transform |
| **Power Change** | `PowerChangedEvent` | Number counter + pulse effect |
| **Card Move** | `CardMovedEvent` | `layout` handles automatically |
| **Card Destroy** | `CardDestroyedEvent` | `AnimatePresence` exit animation |
| **Turn Start** | `TurnStartedEvent` | Energy counter animation |

### 2.3 Event Sequencer

```typescript
// hooks/useAnimations.ts
export function useAnimationSequencer() {
  const [queue, setQueue] = useState<GameEvent[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);

  const playEvents = async (events: GameEvent[]) => {
    setIsAnimating(true);
    
    for (const event of events) {
      await animateEvent(event);
      await delay(100); // Gap between animations
    }
    
    setIsAnimating(false);
  };

  return { playEvents, isAnimating };
}
```

---

## Phase 3: NPC AI (Week 3)

### 3.1 Greedy Algorithm

```typescript
// ai/greedy.ts
export function computeGreedyAction(
  state: GameState, 
  playerId: 0 | 1
): PlayerAction {
  const legalActions = getLegalActions(state, playerId);
  
  let bestAction: PlayerAction = { type: 'Pass', playerId };
  let bestScore = evaluateState(state, playerId);
  
  for (const action of legalActions) {
    if (action.type === 'Pass') continue;
    
    // Simulate this action (opponent passes)
    const simulated = simulateAction(state, action, playerId);
    const score = evaluateState(simulated, playerId);
    
    if (score > bestScore) {
      bestScore = score;
      bestAction = action;
    }
  }
  
  return bestAction;
}

function evaluateState(state: GameState, playerId: 0 | 1): number {
  let score = 0;
  const enemyId = (1 - playerId) as 0 | 1;
  
  for (const location of state.locations) {
    const myPower = getTotalPower(location, playerId);
    const enemyPower = getTotalPower(location, enemyId);
    
    // Winning a location is very valuable
    if (myPower > enemyPower) score += 1000;
    // Margin matters
    score += myPower - enemyPower;
    // Consider remaining capacity
    score += (4 - getCardCount(location, playerId)) * 10;
  }
  
  // Value cards in hand (future potential)
  const hand = getHand(state, playerId);
  for (const card of hand) {
    score += card.cardDef.basePower * 5;
  }
  
  return score;
}
```

### 3.2 AI Difficulty Levels (Future)

| Level | Strategy |
|-------|----------|
| Easy | Random valid action |
| Medium | Greedy (1-move lookahead) |
| Hard | Minimax (2-3 move lookahead) |
| Expert | Monte Carlo Tree Search |

---

## Phase 4: Polish & UX (Week 3-4)

### 4.1 Visual Design

- Greek mythology theme (marble, gold accents, olive branches)
- Card art placeholders → AI-generated or commissioned later
- Responsive layout (desktop first, tablet support)

### 4.2 UX Improvements

- Drag preview shows valid drop targets
- Highlight location when hovering with card
- Show "waiting for opponent" during NPC thinking
- Victory/defeat screen with stats
- Sound effects (optional)

### 4.3 Accessibility

- Keyboard navigation (Tab through cards, Enter to play)
- Screen reader labels
- Reduced motion option (skip animations)

---

## Phase 5: Firebase Integration (Week 4-5)

### 5.1 Firebase Setup

```bash
npm install firebase
firebase init  # hosting, firestore, functions
```

### 5.2 Move Engine to Cloud Functions

```typescript
// functions/src/game.ts
import { onCall } from 'firebase-functions/v2/https';
import { GameController, validateAction } from './engine';

export const submitAction = onCall(async (request) => {
  const { gameId, action } = request.data;
  // ... validation, resolution, store to Firestore
});
```

### 5.3 Real-time Sync

```typescript
// Client subscribes to game document
onSnapshot(doc(db, 'games', gameId), (snapshot) => {
  const game = snapshot.data();
  setGameState(game.state);
  if (game.lastEvents) {
    playEventAnimations(game.lastEvents);
  }
});
```

---

## Phase 6: Multiplayer (Week 5-6)

### 6.1 Features

- Firebase Authentication (Google, email)
- Matchmaking queue
- Game invites via link
- Reconnection handling
- Turn timer (optional)

### 6.2 Data Model

See previous conversation for Firestore schema.

---

## Testing Strategy

### Unit Tests (Engine)
```typescript
// engine/__tests__/effects.test.ts
describe('AddPowerEffect', () => {
  it('should buff target card by amount', () => {
    const state = createTestState({ ... });
    const [newState, events] = applyEffect(state, effect, sourceCard);
    expect(getCardPower(newState, targetId)).toBe(originalPower + 1);
  });
});
```

### Component Tests
```typescript
// components/__tests__/Card.test.tsx
describe('Card', () => {
  it('should display card info', () => {
    render(<Card card={mockCard} />);
    expect(screen.getByText('Zeus')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument(); // power
  });
});
```

### E2E Tests (Later)
- Playwright for full game flow testing

---

## Timeline Summary

| Week | Focus | Deliverables |
|------|-------|--------------|
| 1 | Engine port | TypeScript engine passes all tests |
| 2 | Core UI | Playable game (no animations) |
| 3 | Animations + AI | Polished single-player experience |
| 4 | Polish | Visual design, UX improvements |
| 5 | Firebase | Backend integration, auth |
| 6 | Multiplayer | Real-time PvP |

---

## Commands Reference

```bash
# Development
cd web
npm install
npm run dev          # Start dev server
npm run test         # Run tests
npm run build        # Production build

# Firebase (Phase 5+)
firebase emulators:start  # Local testing
firebase deploy           # Deploy to production
```

---

## Next Steps

1. [x] Create project structure
2. [ ] Initialize Vite + React + TypeScript
3. [ ] Install dependencies (Framer Motion, Tailwind, Zustand)
4. [ ] Port engine/types.ts
5. [ ] Port engine/models.ts
6. [ ] Continue porting remaining engine files
7. [ ] Build Card component
8. [ ] Build Board layout
9. [ ] Implement game loop
10. [ ] Add animations
11. [ ] Implement greedy AI
