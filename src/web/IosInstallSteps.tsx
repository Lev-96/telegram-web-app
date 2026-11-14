/**
 * Installing the owner web on an iPhone (2026-11-09): there is no install
 * dialog on iOS, so the four steps, numbered, with Safari's own icons where a
 * label alone is hard to find. Shown in the menu card and in the guide the
 * install banner opens. Step 4 names the prompt's button by its own text.
 */
import { useWebText, type WebTextKey } from "@web/web/i18n";
import type { ReactNode } from "react";
import { AddToHomeIcon, ShareIcon } from "./pwaIcons";

const STEPS: Array<{ text: WebTextKey; icon?: ReactNode }> = [
  { text: "web.app.iosStep1", icon: <ShareIcon size={16} /> },
  { text: "web.app.iosStep2", icon: <AddToHomeIcon size={16} /> },
  { text: "web.app.iosStep3" },
  { text: "web.app.iosStep4" },
];

const IosInstallSteps = ({ id }: { id?: string }) => {
  const tw = useWebText();
  return (
    <div id={id} className="web-ios-steps">
      {/* role="list": Safari drops a list's semantics once its markers are hidden. */}
      <ol className="web-ios-steps__list" role="list">
        {STEPS.map(({ text, icon }, i) => (
          <li key={text} className="web-ios-steps__step">
            <span className="web-ios-steps__num" aria-hidden="true">
              {i + 1}
            </span>
            <span className="web-ios-steps__text">
              {tw(text, tw("web.push.allow"))}
              {icon && <span className="web-ios-steps__icon">{icon}</span>}
            </span>
          </li>
        ))}
      </ol>
      <p className="web-ios-steps__note">{tw("web.app.iosNote")}</p>
    </div>
  );
};

export default IosInstallSteps;
