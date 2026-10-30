function PageTitle({ icon, children, className = "" }) {
  return (
    <h1 className={`page-title ${className}`.trim()}>
      <span aria-hidden="true">{icon}</span>
      <span>{children}</span>
    </h1>
  );
}

export default PageTitle;