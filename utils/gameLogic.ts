
import { Cell, GemType, GRID_ROWS, GRID_COLS, GEM_TYPES_ARRAY, CellStatus, LevelConfig, Position, SpecialType } from '../types';

export const LEVELS: LevelConfig[] = [
  { level: 1, targetScore: 1000, moves: 10, description: "Tutorial: Score 1000 pts in 10 moves!" },
  { level: 2, targetScore: 3000, moves: 15, description: "Score 3000 pts in 15 moves." },
  { level: 3, targetScore: 6000, moves: 20, description: "Score 6000 pts in 20 moves." },
  { level: 4, targetScore: 12000, moves: 25, description: "Challenge: 12,000 pts in 25 moves!" },
  { level: 5, targetScore: 25000, moves: 30, description: "Master: 25,000 pts in 30 moves!" },
];

export const getLevelConfig = (level: number) => {
    const base = LEVELS.find(l => l.level === level);
    if (base) return base;
    
    // Procedural generation for levels beyond 5
    const multiplier = level - 4;
    return { 
        level: level,
        targetScore: 25000 + (10000 * multiplier), 
        moves: 30 + (multiplier * 2),
        description: `Endless Mode: Level ${level}`
    };
}

// Determine available gem types based on level to manage difficulty
export const getGemTypesForLevel = (level: number, customCount?: number): GemType[] => {
    // Custom override for Level 1 (or testing)
    if (level === 1 && customCount) {
        // Safe clamp between 3 and 8 (excluding RAINBOW which is index 8)
        const count = Math.max(3, Math.min(8, customCount));
        return GEM_TYPES_ARRAY.slice(0, count);
    }

    // Level 1: Default to 5 colors if no custom count provided
    if (level === 1) {
        return [GemType.RED, GemType.BLUE, GemType.GREEN, GemType.YELLOW, GemType.PURPLE];
    }
    // Level 2: 6 colors
    if (level === 2) {
        return [GemType.RED, GemType.BLUE, GemType.GREEN, GemType.YELLOW, GemType.PURPLE, GemType.ORANGE];
    }
    // Level 3: 7 colors (Add Diamond)
    if (level === 3) {
        return [GemType.RED, GemType.BLUE, GemType.GREEN, GemType.YELLOW, GemType.PURPLE, GemType.ORANGE, GemType.DIAMOND];
    }
    // Level 4+: All colors (Add Star)
    return [GemType.RED, GemType.BLUE, GemType.GREEN, GemType.YELLOW, GemType.PURPLE, GemType.ORANGE, GemType.DIAMOND, GemType.STAR];
};

export const createInitialBoard = (allowedTypes: GemType[]): Cell[][] => {
  const board: Cell[][] = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    const row: Cell[] = [];
    for (let c = 0; c < GRID_COLS; c++) {
      let type: GemType;
      // Simple loop to prevent initial matches
      do {
        type = allowedTypes[Math.floor(Math.random() * allowedTypes.length)];
      } while (
        (c >= 2 && row[c - 1].type === type && row[c - 2].type === type) ||
        (r >= 2 && board[r - 1][c].type === type && board[r - 2][c].type === type)
      );

      row.push({
        id: `cell-${r}-${c}-${Math.random()}`,
        type,
        special: type === GemType.RAINBOW ? 'RAINBOW' : 'NONE',
        status: 'IDLE',
        row: r,
        col: c,
        visualRow: r,
        visualCol: c,
      });
    }
    board.push(row);
  }
  return board;
};

// Check for matches
export const findMatches = (board: Cell[][]): Set<string> => {
  const matchedIds = new Set<string>();

  // Horizontal
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS - 2; c++) {
      const type = board[r][c].type;
      if (type !== undefined && board[r][c+1].type === type && board[r][c+2].type === type) {
        matchedIds.add(board[r][c].id);
        matchedIds.add(board[r][c+1].id);
        matchedIds.add(board[r][c+2].id);
        // continue checking for >3 matches
        let k = c + 3;
        while(k < GRID_COLS && board[r][k].type === type) {
            matchedIds.add(board[r][k].id);
            k++;
        }
      }
    }
  }

  // Vertical
  for (let c = 0; c < GRID_COLS; c++) {
    for (let r = 0; r < GRID_ROWS - 2; r++) {
      const type = board[r][c].type;
      if (type !== undefined && board[r+1][c].type === type && board[r+2][c].type === type) {
        matchedIds.add(board[r][c].id);
        matchedIds.add(board[r+1][c].id);
        matchedIds.add(board[r+2][c].id);
        let k = r + 3;
        while(k < GRID_ROWS && board[k][c].type === type) {
            matchedIds.add(board[k][c].id);
            k++;
        }
      }
    }
  }

  return matchedIds;
};

// Group matched IDs into connected clusters of same-colored gems
export const getConnectedGroups = (board: Cell[][], matchedIds: Set<string>): Cell[][] => {
  const visited = new Set<string>();
  const groups: Cell[][] = [];

  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const cell = board[r][c];
      // Start a BFS if this cell is matched and not yet visited
      if (matchedIds.has(cell.id) && !visited.has(cell.id)) {
        const group: Cell[] = [];
        const queue: Cell[] = [cell];
        visited.add(cell.id);
        
        while (queue.length > 0) {
          const current = queue.shift()!;
          group.push(current);
          
          const neighbors = [
            { r: current.row - 1, c: current.col },
            { r: current.row + 1, c: current.col },
            { r: current.row, c: current.col - 1 },
            { r: current.row, c: current.col + 1 },
          ];

          for (const n of neighbors) {
            if (n.r >= 0 && n.r < GRID_ROWS && n.c >= 0 && n.c < GRID_COLS) {
               const neighbor = board[n.r][n.c];
               // Must be in the matched set AND have the same type to be part of this scoring group
               if (matchedIds.has(neighbor.id) && !visited.has(neighbor.id) && neighbor.type === current.type) {
                  visited.add(neighbor.id);
                  queue.push(neighbor);
               }
            }
          }
        }
        groups.push(group);
      }
    }
  }
  return groups;
}

// Identify if a group is a horizontal line, vertical line, or other
export const classifyMatchGroup = (group: Cell[]): { special: SpecialType } => {
    if (group.length < 4) return { special: 'NONE' };
    
    // Check for 5+ match
    if (group.length >= 5) {
        // If strictly linear (row or col only), it's a Rainbow
        const rows = new Set(group.map(c => c.row));
        const cols = new Set(group.map(c => c.col));
        if (rows.size === 1 || cols.size === 1) {
            return { special: 'RAINBOW' };
        }
        // If not linear (T or L shape), it's an Area Blast (Bomb Gem)
        return { special: 'AREA_BLAST' };
    }

    // Match 4
    const rows = new Set(group.map(c => c.row));
    const cols = new Set(group.map(c => c.col));
    // If all in same row (horizontal match) -> Create Vertical Blast (clears column)
    if (rows.size === 1) return { special: 'COL_BLAST' };
    // If all in same col (vertical match) -> Create Horizontal Blast (clears row)
    if (cols.size === 1) return { special: 'ROW_BLAST' };

    return { special: 'NONE' };
}


// Get cells affected by a bomb (3x3 area)
export const getBombAffectedCells = (board: Cell[][], center: Position): string[] => {
    const ids: string[] = [];
    for(let r = center.row - 1; r <= center.row + 1; r++) {
        for(let c = center.col - 1; c <= center.col + 1; c++) {
            if (r >= 0 && r < GRID_ROWS && c >= 0 && c < GRID_COLS) {
                ids.push(board[r][c].id);
            }
        }
    }
    return ids;
}

// Get cells affected by special blast
export const getSpecialBlastTargets = (board: Cell[][], cell: Cell): Cell[] => {
    const targets: Cell[] = [];
    if (cell.special === 'ROW_BLAST') {
        for(let c = 0; c < GRID_COLS; c++) targets.push(board[cell.row][c]);
    } else if (cell.special === 'COL_BLAST') {
        for(let r = 0; r < GRID_ROWS; r++) targets.push(board[r][cell.col]);
    } else if (cell.special === 'AREA_BLAST') {
        // 3x3 Explosion centered on the cell
        for(let r = cell.row - 1; r <= cell.row + 1; r++) {
            for(let c = cell.col - 1; c <= cell.col + 1; c++) {
                 if (r >= 0 && r < GRID_ROWS && c >= 0 && c < GRID_COLS) {
                     targets.push(board[r][c]);
                 }
            }
        }
    } else if (cell.special === 'RAINBOW') {
        // Fallback for rainbow explosion if triggered indirectly
        for(let i=0; i<5; i++) {
            const r = Math.floor(Math.random() * GRID_ROWS);
            const c = Math.floor(Math.random() * GRID_COLS);
            targets.push(board[r][c]);
        }
    }
    return targets;
}

// Process drop down logic
export const applyGravity = (board: Cell[][], allowedTypes: GemType[]): { newBoard: Cell[][], movesDetected: boolean } => {
  const newBoard = board.map(row => row.map(cell => ({ ...cell })));
  let movesDetected = false;

  for (let c = 0; c < GRID_COLS; c++) {
    let emptySlots = 0;
    for (let r = GRID_ROWS - 1; r >= 0; r--) {
      if (newBoard[r][c].status === 'MATCHED' || newBoard[r][c].status === 'EMPTY') {
        emptySlots++;
        newBoard[r][c].status = 'EMPTY'; // Ensure marked empty
      } else if (emptySlots > 0) {
        // Move current cell down by emptySlots
        const cell = newBoard[r][c];
        newBoard[r + emptySlots][c] = {
          ...cell,
          row: r + emptySlots,
          status: 'DROPPING',
          visualRow: r // Start visual from where it was
        };
        newBoard[r][c] = { 
            id: `temp-${r}-${c}-${Math.random()}`, 
            type: GemType.RED, // placeholder
            special: 'NONE',
            status: 'EMPTY', 
            row: r, 
            col: c,
            visualRow: r,
            visualCol: c
        };
        movesDetected = true;
      }
    }

    // Fill top empty slots with new gems
    for (let r = 0; r < emptySlots; r++) {
      const type = allowedTypes[Math.floor(Math.random() * allowedTypes.length)];
      newBoard[r][c] = {
        id: `new-${c}-${Math.random()}`,
        type: type,
        special: type === GemType.RAINBOW ? 'RAINBOW' : 'NONE',
        status: 'DROPPING',
        row: r,
        col: c,
        visualRow: r - emptySlots, // Start visual above board
        visualCol: c,
      };
      movesDetected = true;
    }
  }

  return { newBoard, movesDetected };
};
