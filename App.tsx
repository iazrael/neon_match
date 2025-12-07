
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Volume2,
  VolumeX,
  Play,
  Timer,
  Trophy,
  ArrowRight,
  RotateCcw,
  Footprints,
  Bomb,
  Shuffle,
  MoveHorizontal,
  MoveVertical,
  Maximize,
  Star,
  Settings,
  Turtle,
  Zap
} from 'lucide-react';
import { Cell, CellStatus, GemType, GRID_COLS, GRID_ROWS, Particle, FloatingText, Position, GamePhase, ItemType, SpecialType } from './types';
import { createInitialBoard, findMatches, applyGravity, getConnectedGroups, getLevelConfig, getBombAffectedCells, classifyMatchGroup, getSpecialBlastTargets, getGemTypesForLevel } from './utils/gameLogic';
import { audioService } from './services/audioService';

// Constants for animation timing
const ANIMATION_DURATION = 300;
const MAX_COMBO_TIME = 100; // Abstract units for the timer bar
const COMBO_DECAY_RATE = 0.5; // How fast the bar decreases per tick

const App: React.FC = () => {
  const [board, setBoard] = useState<Cell[][]>([]);
  const [selectedPos, setSelectedPos] = useState<Position | null>(null);
  const [score, setScore] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  // Game Flow State
  const [gamePhase, setGamePhase] = useState<GamePhase>('START');
  const [currentLevel, setCurrentLevel] = useState(1);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [movesLeft, setMovesLeft] = useState<number>(0);
  const [level1GemCount, setLevel1GemCount] = useState(5); // Default 5 types
  
  // Tools & Inventory
  const [inventory, setInventory] = useState({ [ 'BOMB' as ItemType]: 2, ['REFRESH' as ItemType]: 2 });
  const [activeTool, setActiveTool] = useState<ItemType | null>(null);

  const [particles, setParticles] = useState<Particle[]>([]);
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
  
  // Combo System
  const [combo, setCombo] = useState(0);
  const [comboTimer, setComboTimer] = useState(0);
  
  // Visual Effects
  const [shake, setShake] = useState(false);

  // Gesture state
  const touchStartRef = useRef<{ x: number, y: number } | null>(null);
  const activeCellRef = useRef<Position | null>(null);
  
  const levelConfig = getLevelConfig(currentLevel);
  // Pass the override only if it's level 1
  const activeGemTypes = getGemTypesForLevel(currentLevel, currentLevel === 1 ? level1GemCount : undefined);

  // Calculate current multiplier for display
  const levelComboStep = 0.5 + ((currentLevel - 1) * 0.1);
  const currentMultiplier = 1 + (combo * levelComboStep);

  // Initialize Level
  const startLevel = useCallback((level: number) => {
    const config = getLevelConfig(level);
    const types = getGemTypesForLevel(level, level === 1 ? level1GemCount : undefined);
    
    setCurrentLevel(level);
    setScore(0);
    setCombo(0);
    setComboTimer(0);
    setTimeLeft(config.timeLimit || null);
    setMovesLeft(config.moves);
    setBoard(createInitialBoard(types));
    setInventory({ BOMB: 2, REFRESH: 2 }); // Reset inventory for new level
    setActiveTool(null);
    setGamePhase('PLAYING');
    audioService.playLevelUp();
    // Clear particles
    setParticles([]);
    setFloatingTexts([]);
  }, [level1GemCount]);

  const resetGame = () => {
      startLevel(1);
  };

  const goHome = () => {
      setGamePhase('START');
      audioService.playSelect();
  };

  const triggerShake = () => {
      setShake(true);
      setTimeout(() => setShake(false), 300);
  };

  // Timer Effect (Level Timer)
  useEffect(() => {
    if (gamePhase !== 'PLAYING' || timeLeft === null) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null || prev <= 0) {
            clearInterval(timer);
            if (prev === 0) setGamePhase('GAME_OVER');
            return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gamePhase, timeLeft]);

  // Combo Timer Decay Effect
  useEffect(() => {
    if (gamePhase !== 'PLAYING') return;
    
    // Only decay if combo exists and we are NOT processing
    if (combo > 0 && !isProcessing) {
        const interval = setInterval(() => {
            setComboTimer(prev => {
                if (prev <= 0) {
                    setCombo(0);
                    return 0;
                }
                return prev - COMBO_DECAY_RATE;
            });
        }, 16); // ~60fps tick

        return () => clearInterval(interval);
    }
  }, [combo, isProcessing, gamePhase]);

  // Check Win/Loss Conditions
  useEffect(() => {
      if (gamePhase !== 'PLAYING') return;

      // Win Condition: Target Score Reached
      if (score >= levelConfig.targetScore) {
          setGamePhase('LEVEL_COMPLETE');
          audioService.playLevelUp();
          return;
      }

      // Loss Condition: Out of Moves & Board Stable
      if (!isProcessing && movesLeft <= 0 && score < levelConfig.targetScore) {
          setGamePhase('GAME_OVER');
      }

  }, [score, gamePhase, levelConfig.targetScore, movesLeft, isProcessing]);


  // --- Visual Effects System ---
  const spawnParticles = (r: number, c: number, color: string, count = 8, sizeMultiplier = 1) => {
    const newParticles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      newParticles.push({
        id: Math.random(),
        x: c * 100 + 50, // rough percent or px
        y: r * 100 + 50,
        color,
        angle: Math.random() * Math.PI * 2,
        speed: (2 + Math.random() * 3) * sizeMultiplier,
        life: 1.0,
        size: sizeMultiplier
      });
    }
    setParticles(prev => [...prev, ...newParticles]);
  };

  const spawnFloatingText = (r: number, c: number, text: string) => {
      setFloatingTexts(prev => [...prev, {
          id: Math.random(),
          x: c,
          y: r,
          text,
          life: 1.0
      }]);
  };

  // Particle Loop
  useEffect(() => {
    if (particles.length === 0 && floatingTexts.length === 0) return;
    
    const interval = setInterval(() => {
      setParticles(prev => prev.map(p => ({
        ...p,
        x: p.x + Math.cos(p.angle) * p.speed,
        y: p.y + Math.sin(p.angle) * p.speed,
        life: p.life - 0.05
      })).filter(p => p.life > 0));

      setFloatingTexts(prev => prev.map(t => ({
          ...t,
          y: t.y - 0.05, // Float up
          life: t.life - 0.02
      })).filter(t => t.life > 0));
    }, 16);

    return () => clearInterval(interval);
  }, [particles.length, floatingTexts.length]);


  // --- Game Loop Logic ---

  // Check for matches and handle cascading
  const resolveBoard = useCallback(async (currentBoard: Cell[][], currentCombo: number, lastSwapTarget?: Position) => {
    setIsProcessing(true);

    // 1. Initial Match Detection
    const matchedIds = findMatches(currentBoard);
    
    // Include manually exploded cells (Bombs)
    currentBoard.forEach(row => row.forEach(cell => {
        if (cell.status === 'MATCHED') matchedIds.add(cell.id);
    }));

    // 2. Expand Matches (Chain Reactions)
    // If a match includes a special gem, add its blast area to the matched set
    const processedSpecials = new Set<string>();
    let queue = Array.from(matchedIds);
    let specialTriggered = false;

    while (queue.length > 0) {
        const id = queue.shift()!;
        // Find the cell object
        let cell: Cell | undefined;
        for(let r=0; r<GRID_ROWS; r++) for(let c=0; c<GRID_COLS; c++) {
            if (currentBoard[r][c].id === id) cell = currentBoard[r][c];
        }

        if (cell && cell.special !== 'NONE' && !processedSpecials.has(cell.id)) {
            processedSpecials.add(cell.id);
            specialTriggered = true;
            const targets = getSpecialBlastTargets(currentBoard, cell);
            targets.forEach(t => {
                if (!matchedIds.has(t.id)) {
                    matchedIds.add(t.id);
                    queue.push(t.id); // Add to queue to check if it triggers *another* special
                    
                    // VFX for blast
                    spawnParticles(t.row, t.col, '#FFF', 5, 0.5);
                }
            });
            // Sound effect for blast
            if (soundEnabled) audioService.playExplosion();
        }
    }

    if (specialTriggered) {
        triggerShake();
    }

    if (matchedIds.size > 0) {
      // 3. Score & Create Special Gems
      const naturalMatches = findMatches(currentBoard);
      const groups = getConnectedGroups(currentBoard, naturalMatches);
      
      const newSpecialGems: Map<string, SpecialType> = new Map();
      let turnPoints = 0;

      // --- SCALING LOGIC ---
      // Base points per gem. Increases significantly with level.
      const levelBaseMultiplier = 1 + (currentLevel - 1) * 0.5;
      const basePoints = 20; 

      // Combo Multiplier also scales with level
      const levelComboStep = 0.5 + ((currentLevel - 1) * 0.1);
      const comboMultiplier = 1 + (currentCombo * levelComboStep);

      // Calculate score and determine special creations
      groups.forEach(group => {
         const size = group.length;
         const { special } = classifyMatchGroup(group);
         
         // Size Multiplier
         let sizeMultiplier = 1;
         if (size === 4) sizeMultiplier = 1.5;
         if (size >= 5) sizeMultiplier = 3;

         // Final Formula
         const groupScore = Math.floor(size * basePoints * sizeMultiplier * comboMultiplier * levelBaseMultiplier);
         turnPoints += groupScore;

         // Spawn text
         const center = group[Math.floor(size / 2)];
         spawnFloatingText(center.row, center.col, `+${groupScore}`);

         // Determine if we spawn a special gem and visual effects
         if (size === 4) {
             triggerShake();
             spawnFloatingText(center.row, center.col, "GREAT!");
         } else if (size >= 5) {
             triggerShake();
             spawnFloatingText(center.row, center.col, "UNBELIEVABLE!");
         }

         if (special !== 'NONE') {
             // Find best candidate position
             let candidate = group[0];
             if (lastSwapTarget) {
                 const targetInGroup = group.find(c => c.row === lastSwapTarget.row && c.col === lastSwapTarget.col);
                 if (targetInGroup) candidate = targetInGroup;
             } else {
                 candidate = group[Math.floor(group.length / 2)];
             }
             newSpecialGems.set(candidate.id, special);
             
             spawnFloatingText(candidate.row, candidate.col, special === 'RAINBOW' ? 'BOMB!' : 'BLAST!');
         }
      });

      // Add points for blast debris (non-grouped matches)
      const blastDebrisCount = matchedIds.size - groups.reduce((acc, g) => acc + g.length, 0);
      if (blastDebrisCount > 0) {
          turnPoints += Math.floor(blastDebrisCount * basePoints * levelBaseMultiplier * comboMultiplier);
      }

      setScore(s => s + turnPoints);
      
      // Update Combo State
      const nextCombo = currentCombo + 1;
      setCombo(nextCombo);
      setComboTimer(MAX_COMBO_TIME); // Refill timer
      
      if (soundEnabled && currentCombo >= 0) audioService.playMatch(currentCombo);


      // 4. Update Board Status (Mark as Matched, or Transform to Special)
      const matchedBoard = currentBoard.map(row => row.map(cell => {
        // If this cell is becoming a special gem, do NOT destroy it. 
        if (newSpecialGems.has(cell.id)) {
            const specialType = newSpecialGems.get(cell.id)!;
            
            // Enhanced VFX for special gem creation
            if (specialType === 'RAINBOW') {
                 // Multi-colored explosion for rainbow bomb
                 spawnParticles(cell.row, cell.col, '#ef4444', 6, 2);
                 spawnParticles(cell.row, cell.col, '#3b82f6', 6, 2);
                 spawnParticles(cell.row, cell.col, '#eab308', 6, 2);
            } else {
                 // Gold explosion for blast gems
                 spawnParticles(cell.row, cell.col, '#FFD700', 16, 2);
            }

            return { 
                ...cell, 
                special: specialType, 
                status: 'CREATED' as CellStatus, // Keeps it alive with creation effect
                type: specialType === 'RAINBOW' ? GemType.RAINBOW : cell.type 
            };
        }

        if (matchedIds.has(cell.id)) {
            spawnParticles(cell.row, cell.col, getGemColor(cell.type));
            
            // Add Sparkle Effect (Gold/Silver)
            const sparkleColor = Math.random() > 0.5 ? '#FFD700' : '#E2E8F0';
            spawnParticles(cell.row, cell.col, sparkleColor, 4, 0.5);

            return { ...cell, status: 'MATCHED' as CellStatus };
        }
        return cell;
      }));
      
      setBoard(matchedBoard);
      
      // Wait for "pop" animation
      await new Promise(r => setTimeout(r, ANIMATION_DURATION));

      // 5. Apply Gravity (Drop)
      const { newBoard, movesDetected } = applyGravity(matchedBoard, activeGemTypes);
      setBoard(newBoard);

      // Wait for drop animation
      await new Promise(r => setTimeout(r, ANIMATION_DURATION));

      // 6. Reset visual positions for next frame & recurse
      const settledBoard = newBoard.map(row => row.map(cell => ({
        ...cell,
        status: 'IDLE' as CellStatus,
        visualRow: cell.row,
        visualCol: cell.col
      })));
      setBoard(settledBoard);

      // Recurse to check for matches formed by falling gems
      // Pass nextCombo so the chain continues
      resolveBoard(settledBoard, nextCombo, undefined);
      
    } else {
      // No matches, stabilization complete
      setIsProcessing(false);
    }
  }, [soundEnabled, activeGemTypes, currentLevel]); 

  // Handle Swap
  const handleSwap = async (pos1: Position, pos2: Position) => {
    if (isProcessing || gamePhase !== 'PLAYING') return;
    
    setIsProcessing(true); // Lock interaction
    
    // 1. Optimistic Swap UI
    const tempBoard = board.map(row => row.map(c => ({...c})));
    const cell1 = tempBoard[pos1.row][pos1.col];
    const cell2 = tempBoard[pos2.row][pos2.col];

    // Swap data and visual target
    tempBoard[pos1.row][pos1.col] = { ...cell2, row: pos1.row, col: pos1.col, visualRow: pos1.row, visualCol: pos1.col, status: 'SWAPPING' };
    tempBoard[pos2.row][pos2.col] = { ...cell1, row: pos2.row, col: pos2.col, visualRow: pos2.row, visualCol: pos2.col, status: 'SWAPPING' };
    
    setBoard(tempBoard);
    setSelectedPos(null);
    if (soundEnabled) audioService.playSwap();

    await new Promise(r => setTimeout(r, ANIMATION_DURATION));

    // 2. CHECK FOR SPECIAL GEM COMBOS
    const isSpecial1 = cell1.special !== 'NONE';
    const isSpecial2 = cell2.special !== 'NONE';
    const isRainbow1 = cell1.special === 'RAINBOW';
    const isRainbow2 = cell2.special === 'RAINBOW';

    // If both are special, we trigger a combo event
    if (isSpecial1 && isSpecial2) {
        setMovesLeft(prev => prev - 1);
        let activeBoard = tempBoard.map(row => row.map(c => ({...c})));

        // Case A: Two Rainbows -> Nuke Board
        if (isRainbow1 && isRainbow2) {
             activeBoard = activeBoard.map(row => row.map(c => ({...c, status: 'MATCHED' as CellStatus})));
        } 
        // Case B: Rainbow + Special -> Convert all gems of special's color to that special
        else if (isRainbow1 || isRainbow2) {
             const rainbowCell = isRainbow1 ? cell1 : cell2;
             const otherCell = isRainbow1 ? cell2 : cell1;
             const targetType = otherCell.type;
             const targetSpecial = otherCell.special;

             activeBoard = activeBoard.map(row => row.map(c => {
                 if (c.id === rainbowCell.id) return { ...c, status: 'MATCHED' as CellStatus };
                 if (c.type === targetType) {
                     spawnParticles(c.row, c.col, getGemColor(c.type));
                     // Temporarily upgrade them to the special type so resolveBoard blasts them
                     return { ...c, special: targetSpecial, status: 'MATCHED' as CellStatus }; 
                 }
                 return c;
             }));
        } 
        // Case C: Blast + Blast (Row/Col) or Area + Blast or Area + Area
        else {
             const blastIds = new Set<string>();
             blastIds.add(cell1.id);
             blastIds.add(cell2.id);

             // Enhance blasts based on combo
             const targets1 = getSpecialBlastTargets(board, cell1);
             const targets2 = getSpecialBlastTargets(board, cell2);
             
             targets1.forEach(t => blastIds.add(t.id));
             targets2.forEach(t => blastIds.add(t.id));

             // If Area + Area, add full 5x5
             if (cell1.special === 'AREA_BLAST' && cell2.special === 'AREA_BLAST') {
                 // 5x5 centered on pos2
                 for(let r=pos2.row-2; r<=pos2.row+2; r++) {
                     for(let c=pos2.col-2; c<=pos2.col+2; c++) {
                         if(board[r]?.[c]) blastIds.add(board[r][c].id);
                     }
                 }
             }
             // If Blast + Area, add 3 rows/cols
             else if ((cell1.special === 'AREA_BLAST' && cell2.special !== 'AREA_BLAST') || 
                      (cell2.special === 'AREA_BLAST' && cell1.special !== 'AREA_BLAST')) {
                 // Clear 3 Rows and 3 Cols centered on pos2
                 for(let r=pos2.row-1; r<=pos2.row+1; r++) {
                     for(let c=0; c<GRID_COLS; c++) if(board[r]?.[c]) blastIds.add(board[r][c].id);
                 }
                 for(let c=pos2.col-1; c<=pos2.col+1; c++) {
                     for(let r=0; r<GRID_ROWS; r++) if(board[r]?.[c]) blastIds.add(board[r][c].id);
                 }
             }

             activeBoard = activeBoard.map(row => row.map(c => {
                 if (blastIds.has(c.id)) {
                    spawnParticles(c.row, c.col, getGemColor(c.type));
                    return { ...c, status: 'MATCHED' as CellStatus };
                 }
                 return c;
             }));
        }

        setBoard(activeBoard);
        audioService.playExplosion();
        triggerShake();
        await new Promise(r => setTimeout(r, ANIMATION_DURATION));
        resolveBoard(activeBoard, combo);
        return;
    }

    // 3. Special Logic: Single Rainbow Swap (Rainbow + Normal)
    if (isRainbow1 || isRainbow2) {
        // Find target color
        let rainbowCell = isRainbow1 ? cell1 : cell2;
        let otherCell = isRainbow1 ? cell2 : cell1;
        let targetType = otherCell.type;

        setMovesLeft(prev => prev - 1);
        
        const activeBoard = tempBoard.map(row => row.map(c => {
            if (c.type === targetType || c.id === rainbowCell.id || c.id === otherCell.id) {
                spawnParticles(c.row, c.col, getGemColor(c.type));
                return { ...c, status: 'MATCHED' as CellStatus };
            }
            return c;
        }));
        
        setBoard(activeBoard);
        if (soundEnabled) audioService.playExplosion();
        triggerShake();
        await new Promise(r => setTimeout(r, ANIMATION_DURATION));
        resolveBoard(activeBoard, combo); 
        return;
    }

    // 4. Standard Logic: Check Validity
    const matches = findMatches(tempBoard);
    
    if (matches.size > 0) {
      // Valid swap, start resolution
      setMovesLeft(prev => prev - 1);
      resolveBoard(tempBoard, combo, pos2); // Use current combo
    } else {
      // Invalid, swap back
      if (soundEnabled) audioService.playInvalid();
      
      const revertBoard = tempBoard.map(row => row.map(c => ({...c})));
      const cellAtPos1 = revertBoard[pos1.row][pos1.col]; 
      const cellAtPos2 = revertBoard[pos2.row][pos2.col];
      
      revertBoard[pos1.row][pos1.col] = {
          ...cellAtPos2, 
          row: pos1.row, col: pos1.col,
          visualRow: pos1.row, visualCol: pos1.col, status: 'IDLE'
      };
      
      revertBoard[pos2.row][pos2.col] = {
          ...cellAtPos1, 
          row: pos2.row, col: pos2.col,
          visualRow: pos2.row, visualCol: pos2.col, status: 'IDLE'
      };
      
      setBoard(revertBoard);
      
      await new Promise(r => setTimeout(r, ANIMATION_DURATION));
      setIsProcessing(false); // Unlock
    }
  };

  const activateBomb = async (centerPos: Position) => {
      if (inventory.BOMB <= 0) return;
      
      setIsProcessing(true);
      setInventory(prev => ({...prev, BOMB: prev.BOMB - 1}));
      setActiveTool(null);
      setSelectedPos(null);

      if (soundEnabled) audioService.playExplosion();

      const idsToDestroy = new Set(getBombAffectedCells(board, centerPos));
      const tempBoard = board.map(row => row.map(cell => {
          if (idsToDestroy.has(cell.id)) {
              spawnParticles(cell.row, cell.col, '#ffffff', 12, 1.5); // White explosion particles
              return { ...cell, status: 'MATCHED' as CellStatus };
          }
          return cell;
      }));

      setBoard(tempBoard);
      triggerShake();
      await new Promise(r => setTimeout(r, ANIMATION_DURATION));
      
      resolveBoard(tempBoard, combo); // Use current combo
  };

  const activateReshuffle = async () => {
      if (isProcessing || inventory.REFRESH <= 0) return;
      
      setIsProcessing(true);
      setInventory(prev => ({...prev, REFRESH: prev.REFRESH - 1}));
      if (soundEnabled) audioService.playReshuffle();

      // Animate Out
      setBoard(prev => prev.map(row => row.map(c => ({...c, status: 'MATCHED' as CellStatus}))));
      await new Promise(r => setTimeout(r, ANIMATION_DURATION));

      // Create new board
      const newBoard = createInitialBoard(activeGemTypes);
      setBoard(newBoard);
      setIsProcessing(false);
  };

  // --- Interaction Handlers ---

  const onCellClick = (r: number, c: number) => {
    if (gamePhase !== 'PLAYING' || isProcessing) return;

    // TOOL LOGIC: BOMB
    if (activeTool === 'BOMB') {
        activateBomb({row: r, col: c});
        return;
    }

    // Normal Swap Logic
    if (board[r][c].status !== 'IDLE') return;
    audioService.resume();

    if (!selectedPos) {
      setSelectedPos({ row: r, col: c });
      if (soundEnabled) audioService.playSelect();
    } else {
      const isAdjacent = Math.abs(selectedPos.row - r) + Math.abs(selectedPos.col - c) === 1;
      if (isAdjacent) {
        handleSwap(selectedPos, { row: r, col: c });
      } else {
        if (selectedPos.row === r && selectedPos.col === c) {
            setSelectedPos(null); // Deselect
        } else {
            setSelectedPos({ row: r, col: c }); // Change selection
            if (soundEnabled) audioService.playSelect();
        }
      }
    }
  };

  const handleTouchStart = (e: React.TouchEvent, r: number, c: number) => {
    if (isProcessing || gamePhase !== 'PLAYING') return;
    
    // Prevent swipe if using bomb
    if (activeTool === 'BOMB') {
        return; 
    }

    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    activeCellRef.current = { row: r, col: c };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current || !activeCellRef.current || isProcessing || activeTool === 'BOMB') return;
    
    const x = e.touches[0].clientX;
    const y = e.touches[0].clientY;
    const deltaX = x - touchStartRef.current.x;
    const deltaY = y - touchStartRef.current.y;
    
    // Threshold for swipe
    if (Math.abs(deltaX) > 40 || Math.abs(deltaY) > 40) {
      let targetRow = activeCellRef.current.row;
      let targetCol = activeCellRef.current.col;

      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // Horizontal
        targetCol += deltaX > 0 ? 1 : -1;
      } else {
        // Vertical
        targetRow += deltaY > 0 ? 1 : -1;
      }

      // Check bounds
      if (targetRow >= 0 && targetRow < GRID_ROWS && targetCol >= 0 && targetCol < GRID_COLS) {
        handleSwap(activeCellRef.current, { row: targetRow, col: targetCol });
        // Reset to prevent multiple swaps in one gesture
        touchStartRef.current = null;
        activeCellRef.current = null;
      }
    }
  };

  // --- Render Helpers ---

  const getGemColor = (type: GemType) => {
    switch (type) {
      case GemType.RED: return '#ef4444';    
      case GemType.BLUE: return '#3b82f6';   
      case GemType.GREEN: return '#22c55e';  
      case GemType.YELLOW: return '#eab308'; 
      case GemType.PURPLE: return '#a855f7'; 
      case GemType.ORANGE: return '#f97316'; 
      case GemType.DIAMOND: return '#06b6d4'; 
      case GemType.STAR: return '#ec4899';   
      case GemType.RAINBOW: return '#6366f1';
      default: return '#fff';
    }
  };

  const getGemEmoji = (type: GemType, special: SpecialType) => {
    // If Rainbow, override
    if (special === 'RAINBOW') return '💣';

    switch (type) {
      case GemType.RED: return '🐶';      // Dog
      case GemType.BLUE: return '🐘';     // Elephant
      case GemType.GREEN: return '🐢';    // Turtle
      case GemType.YELLOW: return '🐱';   // Cat
      case GemType.PURPLE: return '🐰';   // Rabbit
      case GemType.ORANGE: return '🦊';   // Fox
      case GemType.DIAMOND: return '🐵';  // Monkey
      case GemType.STAR: return '🐼';     // Panda
      case GemType.RAINBOW: return '💣';
      default: return '❓';
    }
  };

  // --- Main Render ---

  if (gamePhase === 'START') {
    return (
      <div className="h-screen w-screen bg-slate-900 flex flex-col items-center justify-center text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=2070&auto=format&fit=crop')] bg-cover opacity-20"></div>
        <div className="z-10 text-center space-y-8 p-6 bg-black/50 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl max-w-sm mx-4 w-full">
          <h1 className="text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600 animate-float drop-shadow-sm">
            ZOO MATCH
          </h1>
          <p className="text-slate-300">
             Match 3 animals to score!<br/>
             Match 4 for Blasts, 5 for Bombs!
          </p>
          <div className="flex justify-center gap-4 text-4xl">
              <span>🐶</span><span>🐱</span><span>🐰</span>
          </div>

          {/* Level 1 Settings */}
          <div className="bg-white/10 p-4 rounded-xl border border-white/5 space-y-2">
              <div className="flex items-center justify-between text-sm text-slate-300">
                  <div className="flex items-center gap-2">
                      <Settings size={16} />
                      <span className="font-bold">Difficulty (Colors)</span>
                  </div>
                  <span className="font-mono text-blue-300 text-lg font-bold">{level1GemCount}</span>
              </div>
              <input 
                type="range" 
                min="3" 
                max="8" 
                value={level1GemCount} 
                onChange={(e) => setLevel1GemCount(parseInt(e.target.value))}
                className="w-full accent-blue-500 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-slate-500 font-mono">
                  <span>Easy (3)</span>
                  <span>Hard (8)</span>
              </div>
          </div>

          <button 
            onClick={() => {
                startLevel(1);
                audioService.resume();
            }}
            className="w-full group relative px-8 py-4 bg-blue-600 rounded-xl font-bold text-xl hover:bg-blue-500 transition-all active:scale-95 shadow-[0_0_20px_rgba(37,99,235,0.5)]"
          >
            <div className="flex items-center justify-center gap-2">
                <Play className="fill-white" />
                START
            </div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center relative overflow-hidden touch-none select-none">
       {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-black z-0"></div>
      
      {/* HUD Header */}
      <div className="z-10 w-full max-w-md px-4 pt-4 pb-2 flex flex-col gap-2 bg-white/5 backdrop-blur-sm border-b border-white/10 mb-4 rounded-b-3xl shadow-lg relative">
        {/* Top Row: Level & Score */}
        <div className="flex justify-between items-center">
             <div className="flex items-center gap-2">
                 <button 
                    onClick={goHome}
                    className="p-2 rounded-full bg-slate-800 text-white hover:bg-slate-700 transition-colors border border-white/10"
                 >
                    <Turtle size={18} />
                 </button>

                 <div className="flex items-center gap-2 bg-black/30 px-3 py-1 rounded-full border border-white/5">
                    <Trophy size={16} className="text-yellow-400" />
                    <span className="font-bold text-white">Lv {currentLevel}</span>
                 </div>
             </div>
             
             {/* Moves Counter */}
             <div className={`flex items-center gap-2 px-3 py-1 rounded-full border border-white/5 ${movesLeft <= 3 ? 'bg-red-500/20 text-red-300 animate-pulse' : 'bg-blue-500/20 text-blue-300'}`}>
                <Footprints size={16} />
                <span className="font-mono font-bold">{movesLeft}</span>
             </div>

             {timeLeft !== null && (
                 <div className={`flex items-center gap-2 px-3 py-1 rounded-full border border-white/5 ${timeLeft < 10 ? 'bg-red-500/20 text-red-300 animate-pulse' : 'bg-black/30 text-white'}`}>
                    <Timer size={16} />
                    <span className="font-mono font-bold">{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</span>
                 </div>
             )}

            <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-2 rounded-full bg-slate-800 text-white hover:bg-slate-700 transition-colors border border-white/10">
                {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
        </div>

        {/* Progress Bar & Multiplier Row */}
        <div className="flex gap-2 items-center">
             <div className="relative flex-1 h-6 bg-slate-800 rounded-full overflow-hidden border border-white/10">
                <div 
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-500"
                    style={{ width: `${Math.min(100, (score / levelConfig.targetScore) * 100)}%` }}
                ></div>
                <div className="absolute inset-0 flex items-center justify-between px-3 text-xs font-bold text-white drop-shadow-md">
                    <span>{score.toLocaleString()}</span>
                    <span>Target: {levelConfig.targetScore.toLocaleString()}</span>
                </div>
            </div>

            {/* Live Multiplier Indicator */}
            <div className={`
                relative flex flex-col items-center justify-center min-w-[70px] px-2 py-1 rounded-lg border border-white/10 overflow-hidden
                ${currentMultiplier > 1 ? 'bg-yellow-500/20 border-yellow-500/50' : 'bg-black/30'}
                transition-all duration-300
            `}>
                <div className="flex items-center gap-1 z-10">
                    <Zap size={14} className={currentMultiplier > 1 ? 'text-yellow-400 fill-yellow-400' : 'text-slate-500'} />
                    <span className={`font-mono font-bold text-sm ${currentMultiplier > 1 ? 'text-yellow-300' : 'text-slate-400'}`}>
                        x{currentMultiplier.toFixed(1)}
                    </span>
                </div>
                {/* Visual Timer Bar for Combo */}
                {combo > 0 && (
                    <div className="absolute bottom-0 left-0 h-1 bg-yellow-400 transition-all duration-100 ease-linear"
                         style={{ width: `${(comboTimer / MAX_COMBO_TIME) * 100}%` }}
                    />
                )}
            </div>
        </div>
      </div>

      {/* Combo Indicator (Absolute Center) */}
      <div className={`absolute top-24 left-1/2 -translate-x-1/2 transition-all duration-300 z-50 pointer-events-none ${combo > 1 ? 'opacity-100 scale-110' : 'opacity-0 scale-75'}`}>
           <div className="flex flex-col items-center">
             <span className="text-4xl font-black italic text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-orange-500 drop-shadow-[0_2px_0px_rgba(0,0,0,1)] stroke-black" style={{ WebkitTextStroke: '1px black' }}>
               {combo}x COMBO!
             </span>
           </div>
      </div>

      {/* Game Board Container */}
      <div 
        className={`
            z-10 relative bg-slate-800/40 p-2 rounded-2xl border border-white/5 shadow-2xl backdrop-blur-sm transition-all duration-300
            ${activeTool === 'BOMB' ? 'ring-4 ring-red-500 scale-105' : ''}
            ${shake ? 'animate-shake' : ''}
        `}
        style={{
            width: 'min(95vw, 400px)',
            height: 'min(95vw, 400px)',
        }}
      >
        {activeTool === 'BOMB' && (
             <div className="absolute -top-12 left-0 right-0 text-center font-bold text-red-500 animate-bounce">
                TAP TO EXPLODE!
             </div>
        )}

        {/* Grid Background */}
        <div 
            className="absolute inset-2 grid gap-1"
            style={{ 
                gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
                gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`
            }}
        >
             {Array.from({ length: GRID_ROWS * GRID_COLS }).map((_, i) => (
                 <div key={i} className="bg-black/20 rounded-lg"></div>
             ))}
        </div>

        {/* Cells */}
        <div className="relative w-full h-full">
            {board.map((row, rIndex) => 
              row.map((cell, cIndex) => {
                const isSelected = selectedPos?.row === rIndex && selectedPos?.col === cIndex;
                const top = (cell.visualRow / GRID_ROWS) * 100;
                const left = (cell.visualCol / GRID_COLS) * 100;
                const width = 100 / GRID_COLS;
                const height = 100 / GRID_ROWS;
                const color = getGemColor(cell.type);
                const isRainbow = cell.special === 'RAINBOW';
                const isSpecial = cell.special !== 'NONE';
                
                // Enhanced Animation Logic
                const isSwapping = cell.status === 'SWAPPING';
                const isMatched = cell.status === 'MATCHED';
                const isCreated = cell.status === 'CREATED';
                
                let transform = 'scale(1)';
                let zIndex = 10;
                
                if (isSwapping) {
                    transform = 'scale(1.15)'; // Pop effect during swap
                    zIndex = 30; // Bring to front
                } else if (isSelected) {
                    zIndex = 20;
                }

                // If matched, animate-disappear handles the transform/opacity via CSS keyframes

                return (
                  <div
                    key={cell.id}
                    onMouseDown={() => onCellClick(rIndex, cIndex)}
                    onTouchStart={(e) => {
                        if (activeTool === 'BOMB') {
                             activateBomb({row: rIndex, col: cIndex});
                        } else {
                            handleTouchStart(e, rIndex, cIndex);
                        }
                    }}
                    onTouchMove={handleTouchMove}
                    className={`absolute flex items-center justify-center cursor-pointer ${isMatched ? 'animate-disappear' : ''}`}
                    style={{
                      top: `${top}%`,
                      left: `${left}%`,
                      width: `${width}%`,
                      height: `${height}%`,
                      transform: isMatched ? undefined : transform, // Let keyframe handle matched state
                      zIndex: zIndex,
                      // Custom cubic bezier for bouncy "snap" effect
                      transition: isSwapping 
                        ? 'all 300ms cubic-bezier(0.34, 1.56, 0.64, 1)' 
                        : (isMatched ? 'none' : 'all 300ms ease-out') // Disable transition for match so keyframe takes over
                    }}
                  >
                    <div 
                        className={`
                            relative w-[90%] h-[90%] flex items-center justify-center text-4xl select-none
                            rounded-xl border-[3px] shadow-sm
                            ${isSelected ? 'scale-110 ring-4 ring-yellow-400/80 shadow-[0_0_20px_rgba(250,204,21,0.6)] z-20' : ''}
                            ${isSwapping ? 'shadow-[0_0_30px_rgba(255,255,255,0.8)] brightness-125 scale-110' : ''}
                            ${activeTool === 'BOMB' ? 'animate-pulse' : ''}
                            ${isRainbow ? 'animate-spin-slow' : ''}
                            ${isCreated ? 'animate-upgrade z-40' : ''}
                            ${isSpecial && !isRainbow ? 'animate-breathe border-white/60 shadow-[0_0_10px_rgba(255,255,255,0.3)]' : ''}
                        `}
                        style={{
                            backgroundColor: isRainbow ? '#1e293b' : `${color}40`, 
                            borderColor: isRainbow ? '#94a3b8' : (isSpecial && !isRainbow ? '#FFF' : color), 
                            boxShadow: `0 3px 0 ${isRainbow ? '#475569' : (isSpecial ? '#FFFFFF80' : color + 'CC')}`,
                            transition: 'all 0.2s'
                        }}
                    >
                         {/* Base Emoji */}
                         <span 
                            className="filter drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)] transform hover:scale-110 transition-transform relative"
                            style={{ 
                                textShadow: '0 2px 0 rgba(0,0,0,0.2)',
                            }}
                        >
                            {getGemEmoji(cell.type, cell.special)}
                            
                            {/* Overlays for Special Gems */}
                            {cell.special === 'ROW_BLAST' && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className="bg-black/40 rounded-full p-0.5 backdrop-blur-[1px]">
                                        <MoveHorizontal size={24} className="text-yellow-400 drop-shadow-[0_2px_0_rgba(0,0,0,1)] stroke-[3]" />
                                    </div>
                                </div>
                            )}
                            {cell.special === 'COL_BLAST' && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className="bg-black/40 rounded-full p-0.5 backdrop-blur-[1px]">
                                        <MoveVertical size={24} className="text-yellow-400 drop-shadow-[0_2px_0_rgba(0,0,0,1)] stroke-[3]" />
                                    </div>
                                </div>
                            )}
                            {cell.special === 'AREA_BLAST' && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className="bg-black/40 rounded-full p-0.5 backdrop-blur-[1px]">
                                        <Maximize size={24} className="text-yellow-400 drop-shadow-[0_2px_0_rgba(0,0,0,1)] stroke-[3]" />
                                    </div>
                                </div>
                            )}
                         </span>
                    </div>
                  </div>
                );
              })
            )}
        </div>
      </div>

      {/* TOOLS BAR */}
      <div className="z-10 mt-6 flex gap-4">
            <button
                onClick={() => {
                    if (activeTool === 'BOMB') setActiveTool(null);
                    else if (inventory.BOMB > 0) setActiveTool('BOMB');
                }}
                disabled={inventory.BOMB === 0 || isProcessing}
                className={`
                    relative flex flex-col items-center justify-center w-20 h-20 rounded-2xl border-2 transition-all
                    ${activeTool === 'BOMB' 
                        ? 'bg-red-500 border-white scale-110 shadow-[0_0_20px_rgba(239,68,68,0.5)]' 
                        : 'bg-slate-800 border-white/10 hover:bg-slate-700'
                    }
                    ${inventory.BOMB === 0 ? 'opacity-50 grayscale cursor-not-allowed' : ''}
                `}
            >
                <div className="absolute -top-2 -right-2 bg-white text-slate-900 font-bold w-6 h-6 rounded-full flex items-center justify-center text-xs border border-slate-900">
                    {inventory.BOMB}
                </div>
                <Bomb size={32} className={activeTool === 'BOMB' ? 'text-white' : 'text-red-400'} />
                <span className="text-[10px] font-bold uppercase mt-1 text-white">Bomb</span>
            </button>

            <button
                onClick={activateReshuffle}
                disabled={inventory.REFRESH === 0 || isProcessing}
                className={`
                    relative flex flex-col items-center justify-center w-20 h-20 rounded-2xl border-2 border-white/10 bg-slate-800 transition-all hover:bg-slate-700
                    ${inventory.REFRESH === 0 ? 'opacity-50 grayscale cursor-not-allowed' : ''}
                `}
            >
                <div className="absolute -top-2 -right-2 bg-white text-slate-900 font-bold w-6 h-6 rounded-full flex items-center justify-center text-xs border border-slate-900">
                    {inventory.REFRESH}
                </div>
                <Shuffle size={32} className="text-blue-400" />
                <span className="text-[10px] font-bold uppercase mt-1 text-white">Refresh</span>
            </button>
      </div>
      
      {/* Overlays */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {particles.map(p => (
                <div 
                    key={p.id}
                    className="absolute rounded-full blur-[1px]"
                    style={{
                        backgroundColor: p.color,
                        width: (p.size || 1) * 12 + 'px',
                        height: (p.size || 1) * 12 + 'px',
                        left: '50%',
                        top: '50%',
                        opacity: p.life,
                        transform: `translate(calc(-50% + ${(p.x - GRID_COLS*50)}px), calc(-50% + ${(p.y - GRID_ROWS*50)}px))`
                    }}
                />
            ))}
             {floatingTexts.map(t => (
                 <div
                    key={t.id}
                    className="absolute text-2xl font-black text-white z-50 animate-pop whitespace-nowrap"
                    style={{
                        left: '50%',
                        top: '50%',
                        opacity: t.life,
                        textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 2px 4px rgba(0,0,0,0.5)',
                        transform: `translate(calc(-50% + ${(t.x - GRID_COLS/2 + 0.5) * 11}vw), calc(-50% + ${(t.y - GRID_ROWS/2 + 0.5) * 11}vw))` 
                    }}
                >
                    {t.text}
                </div>
             ))}
      </div>

      {/* MODALS */}
      {gamePhase === 'LEVEL_COMPLETE' && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-800 p-8 rounded-3xl border border-yellow-500/30 text-center shadow-2xl transform animate-pop">
            <h2 className="text-4xl font-black text-yellow-400 mb-2 drop-shadow-lg">LEVEL COMPLETE!</h2>
            <div className="text-6xl mb-6">🏆</div>
            <p className="text-slate-300 text-xl mb-6">Score: <span className="text-white font-bold">{score}</span></p>
            <button 
              onClick={() => startLevel(currentLevel + 1)}
              className="px-8 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl font-bold text-xl hover:scale-105 transition-transform shadow-lg"
            >
              Next Level
            </button>
          </div>
        </div>
      )}

      {gamePhase === 'GAME_OVER' && (
        <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-50 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-800 p-8 rounded-3xl border border-red-500/30 text-center shadow-2xl transform animate-pop">
            <h2 className="text-4xl font-black text-red-500 mb-2 drop-shadow-lg">GAME OVER</h2>
            <div className="text-6xl mb-6">💀</div>
            <p className="text-slate-300 text-xl mb-6">Final Score: <span className="text-white font-bold">{score}</span></p>
            <div className="flex gap-4 justify-center">
                <button 
                  onClick={() => startLevel(currentLevel)}
                  className="px-6 py-3 bg-slate-700 rounded-xl font-bold hover:bg-slate-600 transition-colors flex items-center gap-2"
                >
                  <RotateCcw size={20} /> Retry
                </button>
                <button 
                  onClick={goHome}
                  className="px-6 py-3 bg-blue-600 rounded-xl font-bold hover:bg-blue-500 transition-colors"
                >
                  Menu
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
