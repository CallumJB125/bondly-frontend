import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ARTICLES } from './articles.js';
import './Blog.css';

const CATEGORIES = ['All', ...Array.from(new Set(ARTICLES.map(a => a.category))).sort()];

export default function BlogIndex() {
  const [activeCategory, setActiveCategory] = useState('All');
  const filtered = activeCategory === 'All' ? ARTICLES : ARTICLES.filter(a => a.category === activeCategory);

  return (
    <div className="blog-page page">
      <div className="container container--narrow">
        <div className="blog-header">
          <p className="blog-header__kicker">Bondly Guide</p>
          <h1 className="blog-header__title">Home Loan Guides for SA Homeowners</h1>
          <p className="blog-header__sub">Plain-language guides on switching, saving, and understanding your bond.</p>
        </div>

        <div className="blog-filters" role="tablist" aria-label="Filter by category">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              role="tab"
              aria-selected={activeCategory === cat}
              className={`blog-filter-tab${activeCategory === cat ? ' blog-filter-tab--active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="blog-list">
          {filtered.map(a => (
            <Link key={a.slug} to={`/blog/${a.slug}`} className="blog-card">
              <div className="blog-card__meta">
                <span className="blog-card__category">{a.category}</span>
                <span className="blog-card__dot">·</span>
                <span className="blog-card__read-time">{a.readTime}</span>
              </div>
              <h2 className="blog-card__title">{a.title}</h2>
              <p className="blog-card__desc">{a.description}</p>
              <span className="blog-card__cta">Read more →</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
