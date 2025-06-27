// lib/analytics.ts

export const trackEvent = (
    action: string,
    category: string,
    label: string,
    value?: number
  ) => {
    // Check if the window.gtag function exists
    if (typeof window.gtag !== 'function') {
      // If not, log a message for debugging in development and exit.
      if (process.env.NODE_ENV === 'development') {
        console.log(
          'GA trackEvent (not sent):',
          { action, category, label, value }
        );
      }
      return;
    }
  
    // If the function exists, send the event.
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
    });
  };