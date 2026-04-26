import { useCallback } from 'react';

// Extend Window interface to include fbq
declare global {
  interface Window {
    fbq?: (command: string, eventName: string, parameters?: object) => void;
  }
}

// Facebook Pixel event types
export type FacebookPixelEvent = 
  | 'PageView'
  | 'Lead' 
  | 'CompleteRegistration'
  | 'Contact'
  | 'SubmitApplication'
  | 'ViewContent'
  | 'AddToCart'
  | 'Purchase';

export interface FacebookPixelEventData {
  content_name?: string;
  content_category?: string;
  value?: number;
  currency?: string;
  [key: string]: any;
}

export const useFacebookPixel = () => {
  const trackEvent = useCallback((eventName: FacebookPixelEvent, eventData?: FacebookPixelEventData) => {
    // Only track in production environment
    if (process.env.NODE_ENV !== 'production') {
      console.log('FB Pixel Event (Dev Mode):', eventName, eventData);
      return;
    }

    // Check if Facebook Pixel is loaded
    if (typeof window !== 'undefined' && window.fbq) {
      try {
        if (eventData) {
          window.fbq('track', eventName, eventData);
        } else {
          window.fbq('track', eventName);
        }
        console.log('FB Pixel Event Tracked:', eventName, eventData);
      } catch (error) {
        console.error('Error tracking Facebook Pixel event:', error);
      }
    } else {
      console.warn('Facebook Pixel not loaded');
    }
  }, []);

  const trackLead = useCallback((data?: { content_name?: string; value?: number }) => {
    trackEvent('Lead', {
      content_name: data?.content_name || 'Lead Form',
      value: data?.value || 0,
      currency: 'BRL',
      ...data
    });
  }, [trackEvent]);

  const trackRegistration = useCallback((data?: { content_name?: string }) => {
    trackEvent('CompleteRegistration', {
      content_name: data?.content_name || 'User Registration',
      ...data
    });
  }, [trackEvent]);

  const trackContact = useCallback((data?: { content_name?: string }) => {
    trackEvent('Contact', {
      content_name: data?.content_name || 'Contact Form',
      ...data
    });
  }, [trackEvent]);

  const trackJobApplication = useCallback((data?: { content_name?: string; job_position?: string }) => {
    trackEvent('SubmitApplication', {
      content_name: data?.content_name || 'Job Application',
      content_category: 'recruitment',
      job_position: data?.job_position,
      ...data
    });
  }, [trackEvent]);

  const trackViewContent = useCallback((data?: { content_name?: string; content_category?: string }) => {
    trackEvent('ViewContent', {
      content_name: data?.content_name || 'Page View',
      content_category: data?.content_category || 'general',
      ...data
    });
  }, [trackEvent]);

  return {
    trackEvent,
    trackLead,
    trackRegistration, 
    trackContact,
    trackJobApplication,
    trackViewContent
  };
};

export default useFacebookPixel;