
'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const SESSION_STORAGE_KEY = 'hasCheckedBrowser';

export default function BrowserRedirect() {
  const pathname = usePathname();

  useEffect(() => {
    // Only run this check on the client side, and only once per session
    const hasChecked = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (hasChecked) {
      return;
    }

    sessionStorage.setItem(SESSION_STORAGE_KEY, 'true');

    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    const isFacebook = /FBAN|FBAV/i.test(userAgent);
    const isInstagram = /Instagram/i.test(userAgent);
    const isAndroid = /android/i.test(userAgent);

    const isKnownInAppBrowser = isFacebook || isInstagram;

    if (isKnownInAppBrowser && isAndroid) {
      // For Android in-app browsers, try to use an intent URL to force open in Chrome.
      // We get the current URL, remove any query params to keep it clean.
      const currentUrl = window.location.origin + pathname;
      
      // The intent URL is specific to Android and tells it to open the URL in the Chrome package.
      const intentUrl = `intent:${currentUrl.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`;
      
      // Attempt the redirection.
      window.location.href = intentUrl;
    }
    
    // For iOS and other non-Android in-app browsers, a direct intent-like redirect isn't possible.
    // The most common behavior is that the user must manually choose to open in the browser.
    // By not doing anything further, we allow them to use the site within the in-app browser
    // if they choose, fulfilling the "one-time check" requirement.

  }, [pathname]);

  // This component renders nothing.
  return null;
}
