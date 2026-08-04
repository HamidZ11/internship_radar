import { useState } from "react";

const ICON_COLORS = [
  "bg-slate-800", "bg-indigo-700", "bg-gray-900",
  "bg-blue-800", "bg-violet-800", "bg-emerald-800",
];

function iconColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return ICON_COLORS[Math.abs(h) % ICON_COLORS.length];
}

function guessDomain(company: string): string {
  const cleaned = company.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${cleaned}.com`;
}

interface Props {
  company: string;
  size: number;
  rounded: string;
  textSize: string;
}

export default function CompanyLogo({ company, size, rounded, textSize }: Props) {
  const [failed, setFailed] = useState(false);
  const bg = iconColor(company);

  if (failed) {
    return (
      <div
        className={`shrink-0 flex items-center justify-center ${rounded} ${bg}`}
        style={{ width: size, height: size }}
      >
        <span className={`font-bold text-white select-none ${textSize}`}>
          {company.charAt(0).toUpperCase()}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`shrink-0 flex items-center justify-center overflow-hidden bg-white ${rounded}`}
      style={{ width: size, height: size }}
    >
      <img
        src={`https://img.logo.dev/${guessDomain(company)}?token=${import.meta.env.VITE_LOGO_DEV_TOKEN}&fallback=404`}
        alt={company}
        width={size}
        height={size}
        onError={() => setFailed(true)}
        className="w-full h-full object-contain p-1.5"
      />
    </div>
  );
}
