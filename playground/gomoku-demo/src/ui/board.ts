import { BOARD_SIZE } from "../game/state";

type BoardEvents = {
  onHover: (cell: { x: number; y: number } | null) => void;
  onClick: (cell: { x: number; y: number }) => void;
};

export class BoardView {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly size: number;
  private readonly cellSize: number;
  private events: Partial<BoardEvents> = {};

  public constructor(size = 480) {
    this.size = size;
    this.cellSize = size / (BOARD_SIZE + 1);
    this.canvas = document.createElement("canvas");
    this.canvas.width = size;
    this.canvas.height = size;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas not supported");
    }
    this.ctx = ctx;
    this.bindEvents();
  }

  public get element() {
    return this.canvas;
  }

  public onHover(handler: BoardEvents["onHover"]) {
    this.events.onHover = handler;
  }

  public onClick(handler: BoardEvents["onClick"]) {
    this.events.onClick = handler;
  }

  public render(
    board: number[][],
    hover: { x: number; y: number } | null,
    ghostColor: 1 | 2 | null,
  ) {
    this.ctx.clearRect(0, 0, this.size, this.size);
    this.drawGrid();
    this.drawStones(board);
    if (hover && ghostColor) {
      this.drawGhost(hover, ghostColor);
    }
  }

  private bindEvents() {
    this.canvas.addEventListener("pointermove", (event) => {
      const cell = this.getCell(event.clientX, event.clientY);
      this.events.onHover?.(cell);
    });
    this.canvas.addEventListener("pointerleave", () => {
      this.events.onHover?.(null);
    });
    this.canvas.addEventListener("pointerdown", (event) => {
      const cell = this.getCell(event.clientX, event.clientY);
      if (cell) {
        this.events.onClick?.(cell);
      }
    });
  }

  private getCell(clientX: number, clientY: number) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    const gridX = Math.round(x / this.cellSize) - 1;
    const gridY = Math.round(y / this.cellSize) - 1;
    if (gridX < 0 || gridY < 0 || gridX >= BOARD_SIZE || gridY >= BOARD_SIZE) {
      return null;
    }
    return { x: gridX, y: gridY };
  }

  private drawGrid() {
    const offset = this.cellSize;
    const end = this.size - this.cellSize;
    this.ctx.strokeStyle = "#51473c";
    this.ctx.lineWidth = 1;
    for (let i = 0; i < BOARD_SIZE; i += 1) {
      const pos = offset + i * this.cellSize;
      this.ctx.beginPath();
      this.ctx.moveTo(offset, pos);
      this.ctx.lineTo(end, pos);
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.moveTo(pos, offset);
      this.ctx.lineTo(pos, end);
      this.ctx.stroke();
    }
  }

  private drawStones(board: number[][]) {
    for (let y = 0; y < BOARD_SIZE; y += 1) {
      for (let x = 0; x < BOARD_SIZE; x += 1) {
        const cell = board[y][x];
        if (!cell) {
          continue;
        }
        this.drawStone(x, y, cell === 1 ? "#141414" : "#f3f3f3", "#444");
      }
    }
  }

  private drawGhost(cell: { x: number; y: number }, player: 1 | 2) {
    const fill = player === 1 ? "rgba(20,20,20,0.35)" : "rgba(245,245,245,0.6)";
    const stroke = "rgba(30,30,30,0.4)";
    this.drawStone(cell.x, cell.y, fill, stroke);
  }

  private drawStone(x: number, y: number, fill: string, stroke: string) {
    const cx = this.cellSize + x * this.cellSize;
    const cy = this.cellSize + y * this.cellSize;
    const radius = this.cellSize * 0.42;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    this.ctx.fillStyle = fill;
    this.ctx.fill();
    this.ctx.strokeStyle = stroke;
    this.ctx.stroke();
  }
}
