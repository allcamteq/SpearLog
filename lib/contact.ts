/**
 * The single place the public contact address is defined.
 *
 * The privacy policy grants rights — account and data deletion, correction —
 * that currently have no self-service route, so they can only be exercised by
 * writing to a human. That makes this address part of the policy rather than
 * decoration: if it stops resolving, the policy is making a promise the app
 * can't keep.
 *
 * Deliberately an alias rather than a personal mailbox: it appears on pages
 * that need no login, so it will be scraped, and an alias can be redirected or
 * replaced without touching the policy text.
 */
export const CONTACT_EMAIL = "allcamteq@gmail.com";

export const CONTACT_MAILTO = `mailto:${CONTACT_EMAIL}`;
