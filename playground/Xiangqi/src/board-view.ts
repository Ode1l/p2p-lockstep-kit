import type {
  XiangqiPoint,
  XiangqiSnapshot,
  XiangqiSide,
  XiangqiPieceType,
} from "./xiangqi-game.js";

type BoardViewEvents = {
  select(point: XiangqiPoint): void;
};

const pieceAssets: Record<XiangqiSide, Record<XiangqiPieceType, string>> = {
  red: {
    general: "/pieces/rk.svg",
    advisor: "/pieces/ra.svg",
    elephant: "/pieces/rb.svg",
    horse: "/pieces/rn.svg",
    rook: "/pieces/rr.svg",
    cannon: "/pieces/rc.svg",
    soldier: "/pieces/rp.svg",
  },
  black: {
    general: "/pieces/bk.svg",
    advisor: "/pieces/ba.svg",
    elephant: "/pieces/bb.svg",
    horse: "/pieces/bn.svg",
    rook: "/pieces/br.svg",
    cannon: "/pieces/bc.svg",
    soldier: "/pieces/bp.svg",
  },
};

const pieceNames: Record<XiangqiPieceType, string> = {
  general: "general",
  advisor: "advisor",
  elephant: "elephant",
  horse: "horse",
  rook: "rook",
  cannon: "cannon",
  soldier: "soldier",
};

const samePoint = (a: XiangqiPoint | null, b: XiangqiPoint) =>
  Boolean(a && a.file === b.file && a.rank === b.rank);

const svgNs = "http://www.w3.org/2000/svg";

export class XiangqiBoardView {
  readonly element = document.createElement("section");

  #status = document.createElement("div");
  #board = document.createElement("div");
  #lines = document.createElementNS(svgNs, "svg");
  #points = document.createElement("div");
  #captured = document.createElement("div");
  #events: Partial<BoardViewEvents> = {};

  constructor() {
    this.element.className = "xiangqi-stage";
    this.#status.className = "xiangqi-status";
    this.#board.className = "xiangqi-board";
    this.#lines.classList.add("xiangqi-lines");
    this.#lines.setAttribute("viewBox", "-0.5 -0.5 9 10");
    this.#lines.setAttribute("aria-hidden", "true");
    this.#points.className = "xiangqi-points";
    this.#points.setAttribute("role", "grid");
    this.#points.setAttribute("aria-label", "Xiangqi board");
    this.#captured.className = "xiangqi-captured";
    this.#board.append(this.#lines, this.#points);
    this.element.append(this.#status, this.#board, this.#captured);
    this.#bindEvents();
  }

  onSelect(handler: BoardViewEvents["select"]) {
    this.#events.select = handler;
  }

  render(input: {
    snapshot: XiangqiSnapshot;
    selected: XiangqiPoint | null;
    legal: XiangqiPoint[];
    localSide: XiangqiSide | null;
    disabled: boolean;
    status: string;
  }) {
    const orientation = input.localSide ?? "red";
    const files = orientation === "red" ? [0, 1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1, 0];
    const ranks = orientation === "red" ? [9, 8, 7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

    this.#renderStatus(input.status);
    this.#renderLines(files, ranks);
    this.#board.toggleAttribute("data-disabled", input.disabled);
    this.#points.setAttribute("aria-disabled", String(input.disabled));
    this.#points.replaceChildren();

    for (const rank of ranks) {
      for (const file of files) {
        const point = { file, rank };
        const piece = input.snapshot.board[rank]![file];
        const isSelected = samePoint(input.selected, point);
        const isLegal = input.legal.some((candidate) => samePoint(candidate, point));
        const isLast = Boolean(
          input.snapshot.lastMove &&
            (samePoint(input.snapshot.lastMove.from, point) ||
              samePoint(input.snapshot.lastMove.to, point)),
        );
        const isCheckedGeneral =
          Boolean(piece) &&
          piece?.type === "general" &&
          piece.side === input.snapshot.sideToMove &&
          input.snapshot.check;

        const button = document.createElement("button");
        button.type = "button";
        button.className = "xiangqi-point";
        button.dataset.file = String(file);
        button.dataset.rank = String(rank);
        button.toggleAttribute("data-selected", isSelected);
        button.toggleAttribute("data-legal", isLegal);
        button.toggleAttribute("data-capture", Boolean(isLegal && piece));
        button.toggleAttribute("data-last", isLast);
        button.toggleAttribute("data-check", isCheckedGeneral);
        button.disabled = input.disabled;
        button.setAttribute("role", "gridcell");
        button.setAttribute(
          "aria-label",
          `${coordinateName(point)}${piece ? `, ${piece.side} ${pieceNames[piece.type]}` : ""}${isLegal ? ", legal move" : ""}`,
        );

        if (piece) {
          const token = document.createElement("img");
          token.className = `xiangqi-piece ${piece.side}`;
          token.src = pieceAssets[piece.side][piece.type];
          token.alt = "";
          token.draggable = false;
          token.setAttribute("aria-hidden", "true");
          button.append(token);
        }

        this.#points.append(button);
      }
    }

    this.#renderCaptured(input.snapshot.captured);
  }

  #bindEvents() {
    this.#points.addEventListener("click", (event) => {
      const point = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>(".xiangqi-point");
      if (!point) return;
      this.#events.select?.({
        file: Number(point.dataset.file),
        rank: Number(point.dataset.rank),
      });
    });
  }

  #renderStatus(status: string) {
    const dot = document.createElement("span");
    dot.className = "xiangqi-status-dot";
    dot.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.textContent = status;
    this.#status.replaceChildren(dot, label);
  }

  #renderLines(files: number[], ranks: number[]) {
    this.#lines.replaceChildren();
    const line = (x1: number, y1: number, x2: number, y2: number, className = "line") => {
      const element = document.createElementNS(svgNs, "line");
      element.setAttribute("x1", String(x1));
      element.setAttribute("y1", String(y1));
      element.setAttribute("x2", String(x2));
      element.setAttribute("y2", String(y2));
      element.setAttribute("class", className);
      this.#lines.append(element);
    };
    const circle = (x: number, y: number) => {
      const element = document.createElementNS(svgNs, "circle");
      element.setAttribute("cx", String(x));
      element.setAttribute("cy", String(y));
      element.setAttribute("r", "0.055");
      element.setAttribute("class", "marker");
      this.#lines.append(element);
    };
    const text = (x: number, y: number, value: string) => {
      const element = document.createElementNS(svgNs, "text");
      element.setAttribute("x", String(x));
      element.setAttribute("y", String(y));
      element.setAttribute("class", "river-text");
      element.textContent = value;
      this.#lines.append(element);
    };
    const toVisual = (point: XiangqiPoint) => ({
      x: files.indexOf(point.file),
      y: ranks.indexOf(point.rank),
    });

    for (let y = 0; y <= 9; y += 1) line(0, y, 8, y);
    for (let x = 0; x <= 8; x += 1) {
      if (x === 0 || x === 8) {
        line(x, 0, x, 9);
      } else {
        line(x, 0, x, 4);
        line(x, 5, x, 9);
      }
    }

    for (const side of ["red", "black"] as const) {
      const ranksForSide = side === "red" ? [0, 2] : [7, 9];
      const a = toVisual({ file: 3, rank: ranksForSide[0]! });
      const b = toVisual({ file: 5, rank: ranksForSide[1]! });
      const c = toVisual({ file: 5, rank: ranksForSide[0]! });
      const d = toVisual({ file: 3, rank: ranksForSide[1]! });
      line(a.x, a.y, b.x, b.y, `palace ${side}`);
      line(c.x, c.y, d.x, d.y, `palace ${side}`);
    }

    for (const point of [
      { file: 1, rank: 2 },
      { file: 7, rank: 2 },
      { file: 1, rank: 7 },
      { file: 7, rank: 7 },
      ...[0, 2, 4, 6, 8].flatMap((file) => [
        { file, rank: 3 },
        { file, rank: 6 },
      ]),
    ]) {
      const visual = toVisual(point);
      circle(visual.x, visual.y);
    }

    text(2.2, 4.66, "楚河");
    text(5.8, 4.66, "漢界");
  }

  #renderCaptured(captured: Array<{ side: XiangqiSide; type: XiangqiPieceType }>) {
    const capturedByRed = captured.filter((piece) => piece.side === "black");
    const capturedByBlack = captured.filter((piece) => piece.side === "red");
    const hasCaptures = capturedByRed.length > 0 || capturedByBlack.length > 0;
    this.#captured.hidden = !hasCaptures;
    this.#captured.replaceChildren();
    if (!hasCaptures) return;

    for (const [label, pieces] of [
      ["Red captured", capturedByRed],
      ["Black captured", capturedByBlack],
    ] as const) {
      const group = document.createElement("div");
      group.className = "xiangqi-captured-group";
      const title = document.createElement("span");
      title.textContent = label;
      const tokens = document.createElement("div");
      tokens.className = "xiangqi-captured-pieces";
      for (const piece of pieces) {
        const token = document.createElement("img");
        token.src = pieceAssets[piece.side][piece.type];
        token.alt = "";
        token.draggable = false;
        token.setAttribute("aria-hidden", "true");
        tokens.append(token);
      }
      group.append(title, tokens);
      this.#captured.append(group);
    }
  }
}

const coordinateName = ({ file, rank }: XiangqiPoint) =>
  `file ${file + 1}, rank ${rank + 1}`;
