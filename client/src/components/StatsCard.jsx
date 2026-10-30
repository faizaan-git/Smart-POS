function StatsCard({ title, value, color, icon }) {
  return (
    <div
      style={{
        background: color,
        color: "#fff",
        padding: "25px",
        borderRadius: "15px",
        boxShadow: "0 4px 15px rgba(0,0,0,0.15)",
      }}
    >
      <div style={{ fontSize: "40px" }}>{icon}</div>

      <h3>{title}</h3>

      <h1>{value}</h1>
    </div>
  );
}

export default StatsCard;