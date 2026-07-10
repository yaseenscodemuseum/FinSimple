"use client";

import { useRef, useEffect } from "react";
import {
  Chart as ChartJS,
  ArcElement,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Pie, Line } from "react-chartjs-2";
import type { SpendingBreakdownData, MonthlyProjectionData } from "@/lib/types";

ChartJS.register(ArcElement, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, Filler);

const PALETTE = [
  "#6B8ACD", "#5B6FA3", "#8B9FD4", "#4A5E8A", "#9BB0DE",
  "#7A8EC2", "#A5B8E0", "#3D4E7A", "#B0C0E8", "#5C70A0",
];

export function SpendingPieChart({ data }: { data: SpendingBreakdownData }) {
  const chartRef = useRef<ChartJS<"pie">>(null);

  useEffect(() => {
    return () => {
      chartRef.current?.destroy();
    };
  }, []);

  return (
    <div className="w-full max-w-xs mx-auto">
      <Pie
        ref={chartRef}
        data={{
          labels: data.categories.map((c) => c.name),
          datasets: [
            {
              data: data.categories.map((c) => c.amount),
              backgroundColor: PALETTE.slice(0, data.categories.length),
              borderWidth: 0,
            },
          ],
        }}
        options={{
          responsive: true,
          plugins: {
            legend: {
              position: "bottom",
              labels: {
                color: "var(--color-text-secondary)",
                font: { size: 11 },
                padding: 12,
              },
            },
          },
        }}
      />
    </div>
  );
}

export function ProjectionLineChart({ data }: { data: MonthlyProjectionData }) {
  const chartRef = useRef<ChartJS<"line">>(null);

  useEffect(() => {
    return () => {
      chartRef.current?.destroy();
    };
  }, []);

  return (
    <div className="w-full">
      <Line
        ref={chartRef}
        data={{
          labels: data.projections.map((p) => p.month),
          datasets: [
            {
              label: "Projected Balance",
              data: data.projections.map((p) => p.cumulative),
              borderColor: "#6B8ACD",
              backgroundColor: "rgba(107, 138, 205, 0.1)",
              fill: true,
              tension: 0.3,
              pointRadius: 5,
              pointBackgroundColor: "#6B8ACD",
            },
          ],
        }}
        options={{
          responsive: true,
          plugins: {
            legend: { display: false },
          },
          scales: {
            y: {
              ticks: { color: "var(--color-text-secondary)" },
              grid: { color: "rgba(107, 138, 205, 0.1)" },
            },
            x: {
              ticks: { color: "var(--color-text-secondary)" },
              grid: { display: false },
            },
          },
        }}
      />
    </div>
  );
}

export function getChartAsPng(canvas: HTMLCanvasElement | null): string | null {
  if (!canvas) return null;
  return canvas.toDataURL("image/png");
}
