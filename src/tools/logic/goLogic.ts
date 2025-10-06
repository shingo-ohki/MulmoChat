export type Cell = "." | "B" | "W";
export type Side = "B" | "W";
export type GoBoard = Cell[][]; // 9x9

export type NewGameCommand = {
  action: "new_game";
  playerNames: { B: string; W: string };
};

export type MoveCommand =
  | {
      action: "move";
      row: number;
      col: number;
      board: GoBoard;
      currentSide: Side;
      playerNames: { B: string; W: string };
      capturedStones: { B: number; W: number };
    }
  | {
      action: "pass";
      board: GoBoard;
      currentSide: Side;
      playerNames: { B: string; W: string };
      capturedStones: { B: number; W: number };
      consecutivePasses: number;
    };

export type Command = NewGameCommand | MoveCommand;

export type GoState = {
  board: GoBoard;
  currentSide: Side;
  playerNames: { B: string; W: string };
  capturedStones: { B: number; W: number };
  counts: { B: number; W: number; empty: number };
  isTerminal: boolean;
  winner: Side | "draw" | null;
  consecutivePasses: number;
  lastAction:
    | { type: "new_game" }
    | { type: "move"; row: number; col: number; captured: number }
    | { type: "pass" };
  error?: string;
};

const BOARD_SIZE = 9;

const DIRECTIONS = [
  [-1, 0], // up
  [1, 0], // down
  [0, -1], // left
  [0, 1], // right
];

function createEmptyBoard(): GoBoard {
  const board: GoBoard = [];
  for (let i = 0; i < BOARD_SIZE; i++) {
    board[i] = new Array(BOARD_SIZE).fill(".") as Cell[];
  }
  return board;
}

function copyBoard(board: GoBoard): GoBoard {
  return board.map((row) => [...row]);
}

function isInBounds(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function getOpponent(side: Side): Side {
  return side === "B" ? "W" : "B";
}

// Find all stones connected to the stone at (row, col)
function getGroup(
  board: GoBoard,
  row: number,
  col: number,
  visited: boolean[][],
): { row: number; col: number }[] {
  const color = board[row][col];
  if (color === ".") return [];

  const group: { row: number; col: number }[] = [];
  const stack: { row: number; col: number }[] = [{ row, col }];

  while (stack.length > 0) {
    const pos = stack.pop()!;
    const r = pos.row;
    const c = pos.col;

    if (!isInBounds(r, c) || visited[r][c] || board[r][c] !== color) {
      continue;
    }

    visited[r][c] = true;
    group.push({ row: r, col: c });

    for (const [dr, dc] of DIRECTIONS) {
      stack.push({ row: r + dr, col: c + dc });
    }
  }

  return group;
}

// Check if a group has any liberties (empty adjacent spaces)
function hasLiberties(
  board: GoBoard,
  group: { row: number; col: number }[],
): boolean {
  for (const { row, col } of group) {
    for (const [dr, dc] of DIRECTIONS) {
      const r = row + dr;
      const c = col + dc;
      if (isInBounds(r, c) && board[r][c] === ".") {
        return true;
      }
    }
  }
  return false;
}

// Remove captured stones and return count
function removeCapturedStones(
  board: GoBoard,
  opponentSide: Side,
): { board: GoBoard; capturedCount: number } {
  const newBoard = copyBoard(board);
  const visited: boolean[][] = Array(BOARD_SIZE)
    .fill(null)
    .map(() => Array(BOARD_SIZE).fill(false));
  let capturedCount = 0;

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (newBoard[row][col] === opponentSide && !visited[row][col]) {
        const group = getGroup(newBoard, row, col, visited);
        if (!hasLiberties(newBoard, group)) {
          // Remove captured group
          for (const { row: r, col: c } of group) {
            newBoard[r][c] = ".";
            capturedCount++;
          }
        }
      }
    }
  }

  return { board: newBoard, capturedCount };
}

// Check if a move is legal (not suicide rule)
function isLegalMove(
  board: GoBoard,
  row: number,
  col: number,
  side: Side,
): boolean {
  // Position must be empty
  if (board[row][col] !== ".") {
    return false;
  }

  // Try the move
  const testBoard = copyBoard(board);
  testBoard[row][col] = side;

  // First, check if this move captures opponent stones
  const opponentSide = getOpponent(side);
  const { board: boardAfterCapture } = removeCapturedStones(
    testBoard,
    opponentSide,
  );

  // Then check if our own group has liberties (suicide rule)
  const visited: boolean[][] = Array(BOARD_SIZE)
    .fill(null)
    .map(() => Array(BOARD_SIZE).fill(false));
  const ourGroup = getGroup(boardAfterCapture, row, col, visited);

  return hasLiberties(boardAfterCapture, ourGroup);
}

function makeMove(
  board: GoBoard,
  row: number,
  col: number,
  side: Side,
): { newBoard: GoBoard; capturedCount: number } {
  const newBoard = copyBoard(board);
  newBoard[row][col] = side;

  // Remove captured opponent stones
  const opponentSide = getOpponent(side);
  const { board: finalBoard, capturedCount } = removeCapturedStones(
    newBoard,
    opponentSide,
  );

  return { newBoard: finalBoard, capturedCount };
}

function countStones(board: GoBoard): {
  B: number;
  W: number;
  empty: number;
} {
  let B = 0,
    W = 0,
    empty = 0;

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const cell = board[row][col];
      if (cell === "B") B++;
      else if (cell === "W") W++;
      else empty++;
    }
  }

  return { B, W, empty };
}

// Simple territory counting (for ended games)
function calculateTerritory(board: GoBoard): { B: number; W: number } {
  const visited: boolean[][] = Array(BOARD_SIZE)
    .fill(null)
    .map(() => Array(BOARD_SIZE).fill(false));
  let territoryB = 0;
  let territoryW = 0;

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (board[row][col] === "." && !visited[row][col]) {
        // Find empty region
        const region: { row: number; col: number }[] = [];
        const stack: { row: number; col: number }[] = [{ row, col }];
        const adjacentColors = new Set<Cell>();

        while (stack.length > 0) {
          const pos = stack.pop()!;
          const r = pos.row;
          const c = pos.col;

          if (!isInBounds(r, c) || visited[r][c]) continue;

          if (board[r][c] === ".") {
            visited[r][c] = true;
            region.push({ row: r, col: c });

            for (const [dr, dc] of DIRECTIONS) {
              stack.push({ row: r + dr, col: c + dc });
            }
          } else {
            adjacentColors.add(board[r][c]);
          }
        }

        // If region is surrounded by only one color, it's that color's territory
        if (adjacentColors.size === 1) {
          const owner = Array.from(adjacentColors)[0];
          if (owner === "B") {
            territoryB += region.length;
          } else if (owner === "W") {
            territoryW += region.length;
          }
        }
      }
    }
  }

  return { B: territoryB, W: territoryW };
}

function determineWinner(
  board: GoBoard,
  capturedStones: { B: number; W: number },
): Side | "draw" | null {
  const counts = countStones(board);
  const territory = calculateTerritory(board);

  // Score = stones on board + territory + captured opponent stones
  const scoreB = counts.B + territory.B + capturedStones.W;
  const scoreW = counts.W + territory.W + capturedStones.B;

  if (scoreB > scoreW) return "B";
  if (scoreW > scoreB) return "W";
  return "draw";
}

export function playGo(cmd: Command): GoState {
  if (cmd.action === "new_game") {
    const { playerNames } = cmd;
    const board = createEmptyBoard();
    const counts = countStones(board);

    return {
      board,
      currentSide: "B",
      playerNames,
      capturedStones: { B: 0, W: 0 },
      counts,
      isTerminal: false,
      winner: null,
      consecutivePasses: 0,
      lastAction: { type: "new_game" },
    };
  }

  if (cmd.action === "pass") {
    const {
      board,
      currentSide,
      playerNames,
      capturedStones,
      consecutivePasses,
    } = cmd;
    const nextSide = getOpponent(currentSide);
    const counts = countStones(board);
    const newConsecutivePasses = consecutivePasses + 1;

    // Game ends after two consecutive passes
    const isTerminal = newConsecutivePasses >= 2;
    const winner = isTerminal ? determineWinner(board, capturedStones) : null;

    return {
      board,
      currentSide: nextSide,
      playerNames,
      capturedStones,
      counts,
      isTerminal,
      winner,
      consecutivePasses: newConsecutivePasses,
      lastAction: { type: "pass" },
    };
  }

  // Move command
  const { row, col, board, currentSide, playerNames, capturedStones } = cmd;

  // Validate the move
  if (!isLegalMove(board, row, col, currentSide)) {
    const counts = countStones(board);

    return {
      board,
      currentSide,
      playerNames,
      capturedStones,
      counts,
      isTerminal: false,
      winner: null,
      consecutivePasses: 0,
      lastAction: { type: "pass" },
      error: `Invalid move: (${row}, ${col}) is not a legal move for ${currentSide}. The position must be empty and the move must not be suicide.`,
    };
  }

  const { newBoard, capturedCount } = makeMove(board, row, col, currentSide);
  const nextSide = getOpponent(currentSide);
  const counts = countStones(newBoard);

  // Update captured stones count
  const newCapturedStones = { ...capturedStones };
  if (capturedCount > 0) {
    newCapturedStones[currentSide] += capturedCount;
  }

  return {
    board: newBoard,
    currentSide: nextSide,
    playerNames,
    capturedStones: newCapturedStones,
    counts,
    isTerminal: false,
    winner: null,
    consecutivePasses: 0, // Reset on actual move
    lastAction: { type: "move", row, col, captured: capturedCount },
  };
}
