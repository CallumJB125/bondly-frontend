import './primitives.css';

/**
 * Single-line text that ellipsizes and exposes the full value as a native
 * tooltip — use for emails, names, descriptions in dense tables/lists so
 * nothing is silently clipped without a way to read it.
 *
 * Props:
 *  - children: the text (also used as the title unless `title` is given)
 *  - title:    optional explicit tooltip text
 *  - as:       element/tag to render (default 'span')
 */
export default function Truncate({ children, title, as: Tag = 'span', className = '', ...rest }) {
  const text = title ?? (typeof children === 'string' ? children : undefined);
  return (
    <Tag className={`adm-truncate ${className}`.trim()} title={text} {...rest}>
      {children}
    </Tag>
  );
}
