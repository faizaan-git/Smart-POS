import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";

import { Doughnut } from "react-chartjs-2";
import AppIcon from "./AppIcon";

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend
);

function PaymentChart({ data = [] }) {

  const labels = data.map(item => item.paymentMethod);

  const values = data.map(
    item => item._count.paymentMethod
  );

  const chartData = {
    labels,

    datasets: [
      {
        data: values,

        backgroundColor: [
          "#22c55e",
          "#3b82f6",
          "#f59e0b",
        ],

        borderWidth: 2,
      },
    ],
  };

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: "15px",
        padding: "20px",
        boxShadow: "0 8px 20px rgba(0,0,0,.08)",
        height: "350px",
      }}
    >
      <h3><AppIcon name="creditCard" /> Payment Methods</h3>

      {data.length === 0 ? (
        <p>No payment data available.</p>
      ) : (
        <Doughnut data={chartData} />
      )}
    </div>
  );
}

export default PaymentChart;