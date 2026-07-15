import { useEffect, useState } from 'react';

import { faCheck, faClipboard } from '@fortawesome/free-solid-svg-icons';

import { Button } from '~/components/buttons';

interface DebugPayloadProps {
  data?: unknown;
  enableCopy?: boolean;
}

export function DebugPayload({ data, enableCopy }: DebugPayloadProps) {
  const [hasCopied, setHasCopied] = useState(false);
  const json = JSON.stringify(data, null, 2);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setHasCopied(false);
    }, 2000);
    return () => clearTimeout(timeoutId);
  }, [hasCopied]);

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(json);
    setHasCopied(true);
  };

  return (
    <>
      <pre className="rounded-log block max-h-96 overflow-auto bg-gray-100 p-4 shadow-inner">{json}</pre>
      {enableCopy && (
        <Button variant="secondary" onClick={copyToClipboard} endIcon={hasCopied ? faCheck : faClipboard}>
          Copy
        </Button>
      )}
    </>
  );
}
