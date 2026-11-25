/**
 * Shown inside the console's frame while a page reads its files or database. The shapes stand for
 * a title, a row of totals and a panel, so the page does not jump when the real one arrives.
 */
export default function Loading() {
  return (
    <div data-skeleton aria-busy="true">
      <span data-sr role="status">
        Loading…
      </span>
      <div data-skel-line style={{ width: '30%', height: 28 }} />
      <div data-skel-line style={{ width: '55%' }} />
      <div data-skel-row>
        <div data-skel-block />
        <div data-skel-block />
        <div data-skel-block />
      </div>
      <div data-skel-block style={{ height: 180 }} />
    </div>
  );
}
