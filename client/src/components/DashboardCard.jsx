function DashboardCard({
  title,
  value,
  subtitle,
  icon,
  color,
}) {
  return (
    <div
      style={{
        background: color,
        color: "#fff",
        borderRadius: "16px",
        padding: "20px",
        minHeight: "120px",
        boxShadow: "0 8px 20px rgba(0,0,0,.15)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <div>
        <h4
          style={{
            margin: 0,
            opacity: 0.9,
          }}
        >
          {title}
        </h4>

        <h2
          style={{
            marginTop: "10px",
          }}
        >
          {value}
        </h2>
        {subtitle && (
          <p style={{ margin: "6px 0 0", fontSize: "13px", opacity: 0.9 }}>
            {subtitle}
          </p>
        )}
      </div>

      <div
        style={{
          fontSize: "42px",
        }}
      >
        {icon}
      </div>
    </div>
  );
}

export default DashboardCard;