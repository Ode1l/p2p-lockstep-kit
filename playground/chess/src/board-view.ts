import type { ChessPoint, ChessSnapshot, Promotion } from "./chess-game.js";

const pieceGlyphs = {
  white: { p: "♙", n: "♘", b: "♗", r: "♖", q: "♕", k: "♔" },
  black: { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚" },
} as const;

type BoardViewEvents = {
  select(point: ChessPoint): void;
  promote(promotion: Promotion): void;
  cancelPromotion(): void;
};

const samePoint = (a: ChessPoint | null, b: ChessPoint) =>
  Boolean(a && a.file === b.file && a.rank === b.rank);

export class ChessBoardView {
  readonly element = document.createElement("section");
  #board = document.createElement("div");
  #status = document.createElement("div");
  #captured = document.createElement("div");
  #promotion = document.createElement("div");
  #events: Partial<BoardViewEvents> = {};

  constructor() {
    this.element.className = "chess-stage";
    this.#status.className = "chess-status";
    this.#board.className = "chess-board";
    this.#board.setAttribute("role", "grid");
    this.#board.setAttribute("aria-label", "Chess board");
    this.#captured.className = "captured-rail";
    this.#promotion.className = "promotion-layer";
    this.#promotion.hidden = true;
    this.element.append(this.#status, this.#board, this.#captured, this.#promotion);
    this.#bindEvents();
  }

  onSelect(handler: BoardViewEvents["select"]) {
    this.#events.select = handler;
  }

  onPromote(handler: BoardViewEvents["promote"]) {
    this.#events.promote = handler;
  }

  onCancelPromotion(handler: BoardViewEvents["cancelPromotion"]) {
    this.#events.cancelPromotion = handler;
  }

  render(input: {
    snapshot: ChessSnapshot;
    selected: ChessPoint | null;
    legal: ChessPoint[];
    localColor: "white" | "black" | null;
    disabled: boolean;
    status: string;
    promotionColor: "white" | "black" | null;
  }) {
    const orientation = input.localColor ?? "white";
    this.#status.innerHTML = `<span class="status-dot" aria-hidden="true"></span><span>${input.status}</span>`;
    this.#board.toggleAttribute("data-disabled", input.disabled);
    this.#board.setAttribute("aria-disabled", String(input.disabled));
    this.#board.replaceChildren();

    const files = orientation === "white" ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
    const ranks = orientation === "white" ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];

    for (const rank of ranks) {
      for (const file of files) {
        const point = { file, rank };
        const piece = input.snapshot.board[rank]![file];
        const button = document.createElement("button");
        const light = (file + rank) % 2 === 1;
        const isSelected = samePoint(input.selected, point);
        const isLegal = input.legal.some((candidate) => samePoint(candidate, point));
        const isLast = input.snapshot.lastMove &&
          (samePoint(input.snapshot.lastMove.from, point) || samePoint(input.snapshot.lastMove.to, point));
        button.type = "button";
        button.className = `chess-square ${light ? "light" : "dark"}`;
        button.dataset.file = String(file);
        button.dataset.rank = String(rank);
        button.dataset.position = `${String.fromCharCode(97 + file)}${rank + 1}`;
        button.toggleAttribute("data-selected", isSelected);
        button.toggleAttribute("data-legal", isLegal);
        button.toggleAttribute("data-capture", Boolean(isLegal && piece));
        button.toggleAttribute("data-last", Boolean(isLast));
        button.setAttribute("role", "gridcell");
        button.setAttribute(
          "aria-label",
          `${button.dataset.position}${piece ? `, ${piece.color} ${piece.type}` : ""}${isLegal ? ", legal move" : ""}`,
        );
        button.disabled = input.disabled && !input.selected;
        if (piece) {
          const glyph = document.createElement("span");
          glyph.className = `chess-piece ${piece.color}`;
          glyph.textContent = pieceGlyphs[piece.color][piece.type];
          glyph.setAttribute("aria-hidden", "true");
          button.append(glyph);
        }
        if (file === files[0]) {
          const rankLabel = document.createElement("span");
          rankLabel.className = "rank-label";
          rankLabel.textContent = String(rank + 1);
          button.append(rankLabel);
        }
        if (rank === ranks[ranks.length - 1]) {
          const fileLabel = document.createElement("span");
          fileLabel.className = "file-label";
          fileLabel.textContent = String.fromCharCode(97 + file);
          button.append(fileLabel);
        }
        this.#board.append(button);
      }
    }

    const capturedByWhite = input.snapshot.captured.filter((piece) => piece.color === "black");
    const capturedByBlack = input.snapshot.captured.filter((piece) => piece.color === "white");
    const hasCaptures = capturedByWhite.length > 0 || capturedByBlack.length > 0;
    this.#captured.hidden = !hasCaptures;
    this.#captured.innerHTML = hasCaptures
      ? `
        <div class="captured-group"><span>White captured</span><strong>${capturedByWhite.map((piece) => pieceGlyphs.black[piece.type]).join("") || "—"}</strong></div>
        <div class="captured-group"><span>Black captured</span><strong>${capturedByBlack.map((piece) => pieceGlyphs.white[piece.type]).join("") || "—"}</strong></div>
      `
      : "";
    this.#renderPromotion(input.promotionColor);
  }

  #bindEvents() {
    this.#board.addEventListener("click", (event) => {
      const square = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>(".chess-square");
      if (!square) return;
      this.#events.select?.({ file: Number(square.dataset.file), rank: Number(square.dataset.rank) });
    });
    this.#promotion.addEventListener("click", (event) => {
      const choice = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>("[data-promotion]");
      if (choice?.dataset.promotion) {
        this.#events.promote?.(choice.dataset.promotion as Promotion);
      } else if ((event.target as HTMLElement).matches("[data-cancel-promotion]")) {
        this.#events.cancelPromotion?.();
      }
    });
  }

  #renderPromotion(color: "white" | "black" | null) {
    this.#promotion.hidden = !color;
    if (!color) {
      this.#promotion.replaceChildren();
      return;
    }
    this.#promotion.innerHTML = `
      <div class="promotion-dialog" role="dialog" aria-modal="true" aria-label="Choose promotion piece">
        <p>Choose promotion</p>
        <div class="promotion-choices">
          ${(["queen", "rook", "bishop", "knight"] as Promotion[]).map((promotion) => {
            const symbol = { queen: "q", rook: "r", bishop: "b", knight: "n" }[promotion] as "q" | "r" | "b" | "n";
            return `<button type="button" data-promotion="${promotion}" aria-label="Promote to ${promotion}">${pieceGlyphs[color][symbol]}</button>`;
          }).join("")}
        </div>
        <button type="button" class="promotion-cancel" data-cancel-promotion>Cancel</button>
      </div>
    `;
  }
}
