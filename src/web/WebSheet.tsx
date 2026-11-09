/**
 * A bottom sheet on a phone, a small centred card on a wider screen
 * (2026-11-09: the notifications prompt, the iOS install guide). It IS the
 * panel's Modal — its stack, focus trap, Escape, backdrop, ×, scroll lock and
 * exit animation — with the card laid out by `.web-sheet` in web.css.
 *
 * The element marked `data-autofocus` takes the focus when the sheet opens and
 * whenever `view` changes (the Modal focuses only text fields, and a sheet has
 * none), so a screen reader and a keyboard start on its main action.
 */
import Modal from "@/components/ui/Modal";
import { useEffect, useId, useRef, type ReactNode } from "react";

interface Props {
  open: boolean;
  /** × / Escape / backdrop, after the exit animation. */
  onClose: () => void;
  title: string;
  /** What the sheet currently shows; a change moves the focus to its `data-autofocus`. */
  view?: string;
  /** Ask before closing over changed fields (the Modal's default). A sheet whose only field is a filter says false. */
  confirmOnDirty?: boolean;
  children: ReactNode;
}

const WebSheet = ({ open, onClose, title, view, confirmOnDirty, children }: Props) => {
  const titleId = useId();
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) cardRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
  }, [open, view]);

  return (
    <Modal open={open} onClose={onClose} confirmOnDirty={confirmOnDirty}>
      <div ref={cardRef} className="card web-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId} className="web-sheet__title">
          {title}
        </h2>
        {children}
      </div>
    </Modal>
  );
};

export default WebSheet;
