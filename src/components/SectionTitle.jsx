export default function SectionTitle({ kicker, title, children }) {
  return (
    <div className="section-title">
      {kicker && <span>{kicker}</span>}
      <h2>{title}</h2>
      {children && <p>{children}</p>}
    </div>
  );
}
