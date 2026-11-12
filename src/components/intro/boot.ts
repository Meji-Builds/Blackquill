/** localStorage key set once someone has seen the opening. */
export const INTRO_KEY = "oq_intro_seen";

/**
 * Runs in <head> before the page paints: decides whether this visit gets the opening. First visit only (or `?intro`
 * to replay it); never for crawlers, link previews or automated browsers.
 */
export const INTRO_BOOT = `try{var q=/[?&]intro\\b/.test(location.search);if(q||(!localStorage.getItem("${INTRO_KEY}")&&!navigator.webdriver&&!/bot|crawl|spider|preview|facebookexternalhit|whatsapp/i.test(navigator.userAgent))){document.documentElement.setAttribute("data-intro","")}}catch(e){}`;
