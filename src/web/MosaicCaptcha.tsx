import { request } from "@/api/client";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import { useWebText } from "@web/web/i18n";
import { useCallback, useEffect, useState } from "react";

/** `GET /owner-web/captcha`: the picture with the hole, the piece, and the row it sits on. */
interface Challenge {
  id: string;
  background: string;
  piece: string;
  piece_y: number;
  width: number;
  height: number;
  piece_size: number;
}

/**
 * The owner-web sign-in's mosaic captcha (2026-10-01): slide the piece into
 * the hole. The server drew the picture and kept the spot; this only reports
 * where the piece was released, and hands back the one-time token the next
 * sign-in attempt carries. A miss draws a new picture.
 */
const MosaicCaptcha = ({ onSolved }: { onSolved: (token: string) => void }) => {
  const tw = useWebText();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [x, setX] = useState(0);
  const [checking, setChecking] = useState(false);
  const [missed, setMissed] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setChallenge(null);
    setX(0);
    setFailed(false);
    try {
      setChallenge(await request<Challenge>("/owner-web/captcha", { noCache: true }));
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const check = async () => {
    if (!challenge || checking || x === 0) return;
    setChecking(true);
    try {
      const res = await request<{ captcha_token: string }>("/owner-web/captcha", {
        method: "POST",
        body: { id: challenge.id, x },
      });
      onSolved(res.captcha_token);
    } catch {
      setMissed(true);
      void load();
    } finally {
      setChecking(false);
    }
  };

  const pct = (value: number, of: number) => `${(value / of) * 100}%`;

  return (
    <div className="web-captcha" role="group" aria-label={tw("web.captcha.title")}>
      <p className="web-captcha__title">{tw("web.captcha.title")}</p>
      <p className="muted web-captcha__hint">{missed ? tw("web.captcha.missed") : tw("web.captcha.hint")}</p>
      {failed ? (
        <Button type="button" variant="secondary" onClick={() => void load()}>{tw("web.captcha.reload")}</Button>
      ) : !challenge ? (
        <Spinner />
      ) : (
        <>
          <div className="web-captcha__frame" style={{ aspectRatio: `${challenge.width} / ${challenge.height}` }}>
            <img className="web-captcha__bg" src={challenge.background} alt="" draggable={false} />
            <img
              className="web-captcha__piece"
              src={challenge.piece}
              alt=""
              draggable={false}
              style={{
                left: pct(x, challenge.width),
                top: pct(challenge.piece_y, challenge.height),
                width: pct(challenge.piece_size, challenge.width),
              }}
            />
          </div>
          <input
            className="web-captcha__slider"
            type="range"
            min={0}
            max={challenge.width - challenge.piece_size}
            step={1}
            value={x}
            disabled={checking}
            aria-label={tw("web.captcha.slider")}
            onChange={(e) => setX(Number(e.target.value))}
            onPointerUp={() => void check()}
            onKeyUp={(e) => { if (e.key === "Enter") void check(); }}
          />
          <div className="row-between web-captcha__actions">
            <button type="button" className="login-forgot" onClick={() => void load()} disabled={checking}>
              {tw("web.captcha.reload")}
            </button>
            <Button type="button" onClick={() => void check()} disabled={checking || x === 0}>
              {tw("web.captcha.check")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default MosaicCaptcha;
