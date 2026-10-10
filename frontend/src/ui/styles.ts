// Shared class recipes for the Radar visual system.

export const ACCENT = "#2B55D6";

export const focusRing = "outline-none focus-visible:ring-2 focus-visible:ring-[#2B55D6]/40 focus-visible:ring-offset-1";

export const btnSecondary = `ui-press inline-flex h-8 items-center gap-1.5 rounded-[7px] border border-[#E3E6EA] bg-white px-3 text-[13px] font-medium text-[#2A2F37] hover:border-[#D3D7DD] hover:bg-[#F7F8F9] disabled:opacity-60 ${focusRing}`;
export const btnPrimary = `ui-press inline-flex h-8 items-center gap-1.5 rounded-[7px] bg-[#2B55D6] px-3 text-[13px] font-medium text-white shadow-[0_1px_2px_rgb(43_85_214/0.25),inset_0_1px_0_rgb(255_255_255/0.12)] hover:bg-[#2449BC] disabled:opacity-60 ${focusRing}`;
export const btnGhost = `ui-press inline-flex h-8 items-center gap-1.5 rounded-[7px] px-2 text-[13px] font-medium text-[#5F6570] hover:bg-[#F1F3F5] hover:text-[#0F1217] ${focusRing}`;

export const inputCls = "h-8 w-full rounded-[7px] border border-[#E3E6EA] bg-white px-2.5 text-[13px] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[#6B717B] hover:border-[#D3D7DD] focus:border-[#2B55D6]/50 focus:shadow-[0_0_0_3px_rgb(43_85_214/0.12)]";

export const logoCls = "outline outline-1 -outline-offset-1 outline-black/[0.08]";
export const logoFallback = "bg-[#EEF0F3] text-[#454B56]";

export const menuPanel = "w-[210px] rounded-[10px] border border-[#E3E6EA] bg-white p-1 shadow-[0_12px_32px_rgb(15_18_23/0.12)]";
