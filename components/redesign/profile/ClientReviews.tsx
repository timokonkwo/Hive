"use client";
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowUpRight, ChevronLeft, ChevronRight, RefreshCw, Star } from 'lucide-react';
import { dateLabel } from '../marketplace/model';
import { countLabel } from '../agents/model';
import { readReviews, reviewPage, reviewsPerPage } from './model';
import { usePublicRead } from './usePublicRead';
import common from '../marketplace/marketplace.module.css';
import styles from './profile.module.css';

export function ClientReviews({ id }: { id: string }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const page = reviewPage(new URLSearchParams(params.toString()));
  const [revision, setRevision] = useState(0);
  const result = usePublicRead(`/api/agents/${encodeURIComponent(id)}/reviews?page=${page}&limit=${reviewsPerPage}`, revision, readReviews);
  const heading = useRef<HTMLHeadingElement>(null);
  const requestedFocus = useRef(false);
  const pages = result.state === 'success' ? Math.max(1, Math.ceil(result.data.total / reviewsPerPage)) : 1;
  function changePage(next: number) {
    const query = new URLSearchParams(params.toString());
    if (next === 1) query.delete('reviewPage'); else query.set('reviewPage', String(next));
    requestedFocus.current = true;
    router.push(pathname + (query.size ? `?${query}` : '') + '#reviews', { scroll: false });
  }
  useEffect(() => {
    if (result.state !== 'loading' && requestedFocus.current) {
      heading.current?.focus({ preventScroll: true });
      heading.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
      requestedFocus.current = false;
    }
  }, [result.state, page]);
  return <section id="reviews" className={styles.section} aria-labelledby="reviews-heading">
    <div className={styles.sectionHead}><h2 id="reviews-heading" ref={heading} tabIndex={-1}>Client reviews</h2><button className={common.iconButton} onClick={() => setRevision(value => value + 1)} disabled={result.state === 'loading'} aria-label="Refresh reviews"><RefreshCw size={16} aria-hidden="true" /></button></div>
    <div aria-live="polite" className={styles.sectionNote}>{result.state === 'loading' ? 'Loading reviews…' : result.state === 'success' && result.data.total > 0 ? `${countLabel(result.data.total)} ${result.data.total === 1 ? 'review' : 'reviews'}` : null}</div>
    <div aria-label="Client review list" aria-busy={result.state === 'loading'}>
      {result.state === 'loading' && <div className={common.skeleton} aria-hidden="true">{[0, 1].map(i => <div key={i}><span /><span /><span /></div>)}</div>}
      {result.state === 'error' && <div className={styles.empty} role="alert"><h3>Reviews could not be loaded.</h3><p>{result.message}</p><button className={common.primaryAction} onClick={() => setRevision(value => value + 1)}>Try again<RefreshCw size={16} aria-hidden="true" /></button></div>}
      {result.state === 'success' && result.data.reviews.length === 0 && <div className={styles.empty}><h3>{page > pages ? 'This page has no reviews.' : 'No written reviews are available.'}</h3><p>{page > pages ? 'Return to the first page to read the current reviews.' : 'Client feedback will appear here when it is available.'}</p>{page > pages && <button className={common.primaryAction} onClick={() => changePage(1)}>Go to first page</button>}</div>}
      {result.state === 'success' && result.data.reviews.length > 0 && <>
        <ol className={styles.reviewList}>{result.data.reviews.map(review => <li key={review.id} data-client-review>
          <div className={styles.reviewMeta}><span className={styles.rating}>{review.rating !== null && <Star size={16} fill="currentColor" aria-hidden="true" />}{review.rating === null ? 'Rating not listed' : <><strong>{review.rating}</strong> / 5</>}</span><time dateTime={review.createdAt || undefined}>{dateLabel(review.createdAt)}</time></div>
          <p className={styles.comment}>{review.comment || 'No written feedback.'}</p>
          {review.tags.length > 0 && <ul className={styles.skills} aria-label="Review tags">{review.tags.map(tag => <li key={tag}>{tag}</li>)}</ul>}
          {review.taskId ? <Link className={styles.reviewTask} prefetch={false} href={`/marketplace/${review.taskId}`}>{review.title}<ArrowUpRight size={15} aria-hidden="true" /></Link> : <p className={styles.sectionNote}>{review.title}</p>}
        </li>)}</ol>
        <nav className={`${common.pagination} ${styles.pagination}`} aria-label="Review pages"><span>{countLabel((page - 1) * reviewsPerPage + 1)}–{countLabel(Math.min(page * reviewsPerPage, result.data.total))} of {countLabel(result.data.total)}</span><div><button aria-label="Previous reviews" disabled={page <= 1} onClick={() => changePage(page - 1)}><ChevronLeft size={17} aria-hidden="true" /></button><span>Page {page} of {pages}</span><button aria-label="Next reviews" disabled={page >= pages} onClick={() => changePage(page + 1)}><ChevronRight size={17} aria-hidden="true" /></button></div></nav>
      </>}
    </div>
  </section>;
}
