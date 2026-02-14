import type { ShellLayout } from './layout';

type ShellRequests = {
  showRequest: (message: string, yesLabel?: string, noLabel?: string) => Promise<boolean>;
  showWinner: (winner: 0 | 1 | 2, myColor: 1 | 2 | null) => void;
  showNotice: (message: string) => void;
  hideAll: () => void;
};

export const createShellRequests = (layout: ShellLayout): ShellRequests => {
  const { requestBar, requestText, requestYes, requestNo, winnerModal, winnerText, winnerOk, noticeToast } =
    layout;
  let requestResolve: ((approved: boolean) => void) | null = null;
  let noticeTimer: number | null = null;
  const defaultYes = requestYes.textContent ?? "Agree";
  const defaultNo = requestNo.textContent ?? "No";

  const showRequest = (message: string, yesLabel?: string, noLabel?: string) =>
    new Promise<boolean>((resolve) => {
      if (requestResolve) {
        hideRequest(false);
      }
      requestResolve = resolve;
      requestText.textContent = message;
      requestYes.textContent = yesLabel ?? defaultYes;
      requestNo.textContent = noLabel ?? defaultNo;
      requestBar.classList.add("show");
    });

  const hideRequest = (approved: boolean) => {
    if (!requestResolve) {
      return;
    }
    const resolve = requestResolve;
    requestResolve = null;
    requestBar.classList.remove("show");
    resolve(approved);
  };

  requestYes.addEventListener("click", () => hideRequest(true));
  requestNo.addEventListener("click", () => hideRequest(false));
  winnerOk.addEventListener("click", () => winnerModal.classList.remove("show"));

  const showWinner = (winner: 0 | 1 | 2, myColor: 1 | 2 | null) => {

    winnerText.textContent =
      winner === 0 ? 'Draw' : winner === myColor ? 'You win' : 'You lose';
    winnerModal.classList.add("show");
  };

  const showNotice = (message: string) => {
    if (noticeTimer) {
      window.clearTimeout(noticeTimer);
      noticeTimer = null;
    }
    noticeToast.textContent = message;
    noticeToast.classList.add("show");
    noticeTimer = window.setTimeout(() => {
      noticeToast.classList.remove("show");
      noticeTimer = null;
    }, 1500);
  };

  const hideAll = () => {
    requestBar.classList.remove("show");
    winnerModal.classList.remove("show");
  };

  return { showRequest, showWinner, showNotice, hideAll };
};
