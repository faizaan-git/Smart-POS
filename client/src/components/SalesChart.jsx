import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

import { Line } from "react-chartjs-2";
import AppIcon from "./AppIcon";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

function SalesChart({ data = [] }) {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const textColor = isDark ? "#d1d5db" : "#475569";
  const gridColor = isDark
    ? "rgba(148, 163, 184, 0.2)"
    : "rgba(148, 163, 184, 0.25)";

  const chartData = {
    labels: data.map((item) => item.day),

    datasets: [
      {
        label: "Revenue",

        data: data.map((item) => item.revenue),

        borderColor: "#2563eb",

        backgroundColor: "rgba(37,99,235,0.15)",

        fill: true,

        tension: 0.4,

        pointRadius: 5,

        pointHoverRadius: 7,
      },
    ],
  };

  const options = {
    responsive: true,

    maintainAspectRatio: false,

    plugins: {
      legend: {
        display: true,
        labels: {
          color: textColor,
        },
      },

      title: {
        display: false,
      },
    },

    scales: {
      x: {
        ticks: {
          color: textColor,
        },
        grid: {
          color: gridColor,
        },
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: textColor,
        },
        grid: {
          color: gridColor,
        },
      },
    },
  };

  return (
    <div className="sales-chart-card">
      <h3>
        <AppIcon name="chartLine" /> Last 7 Days Revenue
      </h3>

      {data.length === 0 ? (
        <p className="sales-chart-empty">No sales data available.</p>
      ) : (
        <div className="sales-chart-canvas">
          <Line data={chartData} options={options} />
        </div>
      )}
    </div>
  );
}

export default SalesChart;