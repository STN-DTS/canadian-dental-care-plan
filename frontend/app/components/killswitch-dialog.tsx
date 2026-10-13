import { useEffect, useState } from 'react';

import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useTranslation } from 'react-i18next';

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '~/components/dialog';

type KillswitchDialogProps = {
  /**
   * The initial duration (in seconds) for the killswitch countdown.
   * The dialog will remain visible and block the user until this timer counts down to zero.
   */
  timeoutSecs: number;
};

export function KillswitchDialog({ timeoutSecs }: KillswitchDialogProps) {
  const [remainingTime, setRemainingTime] = useState(timeoutSecs);
  const { t } = useTranslation('common');

  // resets `remainingTime` if the parent changes the timeout
  const [prevTimeoutSecs, setPrevTimeoutSecs] = useState(timeoutSecs);

  if (prevTimeoutSecs !== timeoutSecs) {
    setPrevTimeoutSecs(timeoutSecs);
    setRemainingTime(timeoutSecs);
  }

  // the dialog should only activate when `remainingTime` is not zero
  const isDialogActive = remainingTime > 0;

  //
  // decrements `remainingTime` by one every second
  //
  useEffect(() => {
    if (isDialogActive) {
      const timeout = globalThis.setInterval(() => setRemainingTime((prevRemainingTime) => prevRemainingTime - 1), 1000);
      // we must clear the timer when the component unmounts to prevent memory
      // leaks and and errors from trying to update state on an unmounted component
      return () => globalThis.clearInterval(timeout);
    }
  }, [isDialogActive]);

  if (isDialogActive) {
    const { mins, secs } = getTimeComponents(remainingTime);

    return (
      <Dialog open={true}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>
              <FontAwesomeIcon icon={faExclamationTriangle} className="inline" />
              <span> {t(($) => $.killswitch.title)}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <p>{t(($) => $.killswitch.overloaded)}</p>
            <p>{t(($) => $.killswitch.dontWorryBeHappy)}</p>
          </div>
          <DialogFooter>
            {t(($) => $.killswitch.remainingTime, {
              mins: mins,
              secs: secs,
            })}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
}

/**
 * Converts a total duration in seconds into an object representing whole
 * minutes and remaining seconds. Negative input values are treated as 0 seconds
 * before conversion.
 */
function getTimeComponents(seconds: number): { mins: number; secs: number } {
  const time = Math.max(seconds, 0);

  const mins = Math.floor(time / 60);
  const secs = time % 60;

  return { mins, secs };
}
