import { useEffect } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { ARTICLES } from './articles.js';
import './Blog.css';

export default function BlogPost() {
  const { slug } = useParams();
  const article  = ARTICLES.find(a => a.slug === slug);

  useEffect(() => {
    if (!article) return;
    // Article structured data
    const schema = {
      '@context': 'https://schema.org',
      '@type':    'Article',
      headline:   article.title,
      description: article.description,
      datePublished: article.date,
      author: { '@type': 'Organization', name: 'Bondly', url: 'https://bondly.co.za' },
      publisher: {
        '@type': 'Organization',
        name:    'Bondly',
        logo:    { '@type': 'ImageObject', url: 'https://bondly.co.za/icon.svg' },
      },
    };
    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.id   = 'article-schema';
    el.text = JSON.stringify(schema);
    document.head.appendChild(el);

    const prev = document.title;
    document.title = `${article.title} | Bondly`;
    return () => {
      document.getElementById('article-schema')?.remove();
      document.title = prev;
    };
  }, [article]);

  if (!article) return <Navigate to="/blog" replace />;

  const others = ARTICLES.filter(a => a.slug !== slug).slice(0, 2);

  return (
    <div className="blog-page page">
      <div className="container container--narrow">

        <Link to="/blog" className="blog-back">← All guides</Link>

        <article className="blog-article">
          <header className="blog-article__header">
            <div className="blog-article__meta">
              <span className="blog-card__category">{article.category}</span>
              <span className="blog-card__dot">·</span>
              <span>{article.readTime}</span>
              <span className="blog-card__dot">·</span>
              <time dateTime={article.date}>
                {new Date(article.date).toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' })}
              </time>
            </div>
            <h1 className="blog-article__title">{article.title}</h1>
            <p className="blog-article__desc">{article.description}</p>
          </header>

          <div
            className="blog-article__body"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(article.content) }}
          />

          <div className="blog-article__cta">
            <div className="blog-article__cta-inner">
              <div className="blog-article__cta-text">
                <strong>See what you could save in 3 minutes</strong>
                <span>No credit check. Free for homeowners.</span>
              </div>
              <div className="blog-article__cta-actions">
                <Link to="/preapproval" className="btn btn--lime">Switch my bond — free</Link>
                <Link to="/optimize"   className="btn btn--ghost">Financial check first</Link>
              </div>
            </div>
          </div>
        </article>

        {others.length > 0 && (
          <div className="blog-related">
            <h2 className="blog-related__title">More guides</h2>
            <div className="blog-related__grid">
              {others.map(a => (
                <Link key={a.slug} to={`/blog/${a.slug}`} className="blog-card blog-card--compact">
                  <div className="blog-card__meta">
                    <span className="blog-card__category">{a.category}</span>
                    <span className="blog-card__dot">·</span>
                    <span className="blog-card__read-time">{a.readTime}</span>
                  </div>
                  <h3 className="blog-card__title">{a.title}</h3>
                  <span className="blog-card__cta">Read more →</span>
                </Link>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
