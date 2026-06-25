import { useEffect, useRef } from "react";
import { trpc } from "@/providers/trpc";
import { Mail, Send, Users, AlertTriangle, ArrowRight, MailOpen } from "lucide-react";
import { useNavigate } from "react-router";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";

export default function DashboardPage() {
  const navigate = useNavigate();
  const heroRef = useRef<HTMLDivElement>(null);
  const { data: stats } = trpc.dashboard.getStats.useQuery();
  const { data: activity } = trpc.dashboard.getActivity.useQuery({ range: "7d" });
  const { data: recentCampaigns } = trpc.dashboard.getRecentCampaigns.useQuery();

  // Hero parallax effect
  useEffect(() => {
    const handleScroll = () => {
      if (heroRef.current) {
        const scrollY = window.scrollY;
        heroRef.current.style.backgroundPositionY = `${scrollY * 0.3}px`;
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const statusBadgeClass = (status: string) => {
    switch (status) {
      case "draft":
        return "bg-[#f4f7fb] border border-[#e0e0e0] text-[#666666]";
      case "sending":
        return "bg-[#c9a84c]/12 text-[#c9a84c]";
      case "completed":
        return "bg-[#2d8a4e]/12 text-[#2d8a4e]";
      case "failed":
        return "bg-[#c0392b]/12 text-[#c0392b]";
      default:
        return "bg-[#f4f7fb] text-[#666666]";
    }
  };

  return (
    <div>
      {/* Hero Banner */}
      <div
        className="relative w-full h-[280px] overflow-hidden rounded-sm mb-[-40px]"
        style={{
          background: "linear-gradient(135deg, #1a3a5c 0%, #2a4a6c 100%)",
        }}
      >
        {/* Dot pattern with parallax */}
        <div
          ref={heroRef}
          className="absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.12) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
            transform: "translateZ(0)",
          }}
        />
        <div className="absolute bottom-10 left-10 z-10">
          <p className="text-[#8bafd4] text-xs uppercase tracking-wider">Welcome back</p>
          <h2 className="text-white text-[28px] font-semibold mt-1">
            Email Campaign Dashboard
          </h2>
          <p className="text-white/70 text-sm mt-2 max-w-[480px]">
            Manage your outreach, track deliveries, and grow your legal translation business.
          </p>
          <div className="h-[3px] w-[80px] bg-[#c9a84c] mt-4" />
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-5 relative z-10">
        {[
          { label: "Total Sent", value: stats?.totalSent ?? 0, icon: Mail, change: stats?.sentChange },
          { label: "Delivered", value: stats?.delivered ?? 0, icon: Send, change: stats?.deliveredChange },
          { label: "Contacts", value: stats?.totalContacts ?? 0, icon: Users, change: stats?.contactsChange },
          { label: "Failed", value: stats?.failed ?? 0, icon: AlertTriangle, change: stats?.failedChange },
        ].map((stat, i) => (
          <div
            key={i}
            className="bg-white border border-[#e0e0e0] rounded p-6 shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(0,0,0,0.12)] cursor-pointer"
          >
            <div className="w-10 h-10 rounded-full bg-[#f4f7fb] flex items-center justify-center">
              <stat.icon className="w-5 h-5 text-[#1a3a5c]" />
            </div>
            <p className="text-xs text-[#666666] mt-3">{stat.label}</p>
            <p className="text-[32px] font-bold text-[#1a3a5c] leading-tight mt-1">
              {stat.value.toLocaleString()}
            </p>
            {stat.change !== undefined && (
              <p className={`text-xs mt-1 ${stat.change >= 0 ? "text-[#2d8a4e]" : "text-[#c0392b]"}`}>
                {stat.change >= 0 ? "+" : ""}
                {typeof stat.change === "number" ? stat.change.toFixed(1) : stat.change}%
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Recent Campaigns */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[#222222]">Recent Campaigns</h2>
            <div className="h-[3px] w-[40px] bg-[#c9a84c] mt-2" />
          </div>
          <button
            onClick={() => navigate("/campaigns")}
            className="flex items-center gap-1 text-sm text-[#1a3a5c] hover:underline"
          >
            View All <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentCampaigns && recentCampaigns.length > 0 ? (
          <div className="mt-4 bg-white border border-[#e0e0e0] rounded overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-[#f4f7fb]">
                  <th className="text-left px-4 py-3 text-[11px] font-medium text-[#666666] uppercase tracking-wider">
                    Campaign
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-medium text-[#666666] uppercase tracking-wider">
                    Recipients
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-medium text-[#666666] uppercase tracking-wider">
                    Sent
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-medium text-[#666666] uppercase tracking-wider">
                    Failed
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-medium text-[#666666] uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-medium text-[#666666] uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentCampaigns.map((campaign) => (
                  <tr
                    key={campaign.id}
                    className="border-t border-[#e8e8e8] hover:bg-[#f4f7fb] transition-colors cursor-pointer"
                    onClick={() => navigate("/campaigns")}
                  >
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-[#1a3a5c]">{campaign.name}</span>
                      <p className="text-xs text-[#666666] truncate max-w-[200px]">{campaign.subject}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#666666]">{campaign.totalRecipients}</td>
                    <td className="px-4 py-3 text-sm text-[#2d8a4e]">{campaign.sentCount}</td>
                    <td className="px-4 py-3 text-sm text-[#c0392b]">{campaign.failedCount}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2.5 py-0.5 text-xs rounded-full ${statusBadgeClass(campaign.status)}`}>
                        {campaign.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#888888]">
                      {format(new Date(campaign.createdAt), "MMM d, yyyy")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-4 flex flex-col items-center py-16 bg-white border border-[#e0e0e0] rounded">
            <MailOpen className="w-12 h-12 text-[#888888]" />
            <h3 className="text-base font-semibold text-[#666666] mt-4">No campaigns yet</h3>
            <p className="text-sm text-[#888888] mt-1">
              Create your first campaign to start sending emails to your contacts.
            </p>
            <button
              onClick={() => navigate("/campaigns")}
              className="mt-4 px-5 py-2 bg-[#c9a84c] text-[#222222] text-xs font-medium uppercase tracking-wider rounded hover:bg-[#d4b85c] transition-colors"
            >
              Create Campaign
            </button>
          </div>
        )}
      </div>

      {/* Activity Chart */}
      <div className="mt-8 bg-white border border-[#e0e0e0] rounded p-6">
        <h3 className="text-base font-semibold text-[#222222]">Send Activity</h3>
        <div className="mt-4" style={{ height: 400 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={activity || []}>
              <defs>
                <linearGradient id="sentGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1a3a5c" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#1a3a5c" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8e8e8" />
              <XAxis
                dataKey="date"
                tickFormatter={(d) => format(new Date(d), "MMM d")}
                tick={{ fontSize: 12, fill: "#888888" }}
              />
              <YAxis tick={{ fontSize: 12, fill: "#888888" }} />
              <Tooltip
                contentStyle={{
                  background: "white",
                  border: "1px solid #e0e0e0",
                  borderRadius: "4px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                }}
              />
              <Area
                type="monotone"
                dataKey="sent"
                stroke="#1a3a5c"
                strokeWidth={2}
                fill="url(#sentGradient)"
              />
              <Area
                type="monotone"
                dataKey="failed"
                stroke="#c0392b"
                strokeWidth={1}
                fill="transparent"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
