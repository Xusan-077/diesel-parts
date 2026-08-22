/**
 * How many parts each home page collection holds.
 *
 * Set by the desktop layout, which is a four-column grid: eight is two full
 * rows, and two rows is the most a home page can spend on one collection when
 * there are three of them stacked down it. Twelve — the count from when every
 * row was a carousel at every width — made three rows, and three collections
 * of three rows is nine screens of cards before the page says anything else.
 *
 * On a phone the same eight ride a carousel, so the number is what the row
 * scrolls through rather than what it stacks. The rest of the collection is
 * one press away behind "see all", which is what that link is for.
 */
export const HOME_ROW_SIZE = 8;
