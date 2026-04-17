# Graph Report - .  (2026-04-16)

## Corpus Check
- Corpus is ~7,148 words - fits in a single context window. You may not need a graph.

## Summary
- 15 nodes · 17 edges · 3 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## God Nodes (most connected - your core abstractions)
1. `createAutoMatches()` - 3 edges
2. `initDatabase()` - 2 edges
3. `getRandomTeams()` - 2 edges
4. `getRandomOdds()` - 2 edges
5. `startServer()` - 2 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Communities

### Community 0 - "Community 0"
Cohesion: 0.2
Nodes (0): 

### Community 1 - "Community 1"
Cohesion: 0.67
Nodes (3): createAutoMatches(), getRandomOdds(), getRandomTeams()

### Community 2 - "Community 2"
Cohesion: 1.0
Nodes (2): initDatabase(), startServer()

## Knowledge Gaps
- **Thin community `Community 2`** (2 nodes): `initDatabase()`, `startServer()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.