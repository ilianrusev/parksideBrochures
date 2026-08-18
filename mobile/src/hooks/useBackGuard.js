import { useEffect, useRef } from 'react';
import { Platform, BackHandler } from 'react-native';

// Guards registered while overlays/tabs are open. Only the topmost one reacts to a back press.
const stack = [];
// Number of upcoming popstate events caused by our own history.back() calls, which must be ignored.
let selfTriggeredPops = 0;
let listening = false;

function handlePopState() {
  if (selfTriggeredPops > 0) {
    selfTriggeredPops -= 1;
    return;
  }
  const guard = stack.pop();
  if (guard) guard.onBack();
}

function attachListener() {
  if (listening) return;
  window.addEventListener('popstate', handlePopState);
  listening = true;
}

/**
 * Makes the hardware/browser back button dismiss an in-app layer instead of leaving the app.
 * @param {boolean} active whether the layer is currently open
 * @param {() => void} onBack invoked when back is pressed while active
 */
export default function useBackGuard(active, onBack) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!active) return undefined;

    if (Platform.OS !== 'web') {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        onBackRef.current();
        return true;
      });
      return () => sub.remove();
    }

    if (typeof window === 'undefined') return undefined;

    const guard = { onBack: () => onBackRef.current() };
    attachListener();
    window.history.pushState({ backGuard: true }, '', window.location.href);
    stack.push(guard);

    return () => {
      const index = stack.lastIndexOf(guard);
      if (index === -1) return; // already consumed by a back press
      stack.splice(index, 1);
      if (index === stack.length) {
        // Our entry is still the newest one, so drop it to keep history in sync.
        selfTriggeredPops += 1;
        window.history.back();
      }
    };
  }, [active]);
}
