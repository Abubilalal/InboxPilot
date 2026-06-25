import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Search, Download, Mail, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function LogsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const { data: logsData } = trpc.sendLog.list.useQuery({
    page,
    limit: 50,
    search: search || undefined,
    status: statusFilter !== "all" ? (statusFilter as "sent" | "failed") : undefined,
  });

  const { data: stats } = trpc.dashboard.getStats.useQuery();

  const handleExport = () => {
    if (!logsData?.logs) return;
    const headers = ["Timestamp", "Email", "Campaign", "Status", "Detail"];
    const rows = logsData.logs.map((log) => [
      new Date(log.sentAt).toISOString(),
      log.email,
      log.campaignName || "",
      log.status,
      log.detail || "",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map(escapeCsv).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `send-logs-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = logsData ? Math.ceil(logsData.total / 50) : 0;

  return (
    <div>
      <p className="text-sm text-[#666666] -mt-2 mb-5">
        Detailed history of every email sent through your campaigns.
      </p>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-5 mb-5">
        {[
          { label: "Total Sends", value: (stats?.totalSent ?? 0) + (stats?.failed ?? 0), icon: Mail },
          { label: "Successful", value: stats?.delivered ?? 0, icon: Mail, color: "text-[#2d8a4e]" },
          { label: "Failed", value: stats?.failed ?? 0, icon: AlertCircle, color: "text-[#c0392b]" },
          {
            label: "Bounce Rate",
            value: stats && stats.totalSent > 0 ? ((stats.failed / stats.totalSent) * 100).toFixed(1) + "%" : "0%",
            icon: AlertCircle,
            color: "text-[#e67e22]",
          },
        ].map((stat, i) => (
          <div
            key={i}
            className="bg-white border border-[#e0e0e0] rounded p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="w-10 h-10 rounded-full bg-[#f4f7fb] flex items-center justify-center">
              <stat.icon className={`w-5 h-5 ${stat.color || "text-[#1a3a5c]"}`} />
            </div>
            <p className="text-xs text-[#666666] mt-3">{stat.label}</p>
            <p className="text-[32px] font-bold text-[#1a3a5c] leading-tight mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#888888]" />
            <Input
              placeholder="Search email or campaign..."
              className="pl-9 w-[300px] h-10 border-[#e0e0e0]"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-10 border-[#e0e0e0]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 h-10 px-4 border border-[#e0e0e0] rounded text-sm text-[#222222] hover:bg-[#f4f7fb] transition-colors"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* Logs Table */}
      {logsData?.logs && logsData.logs.length > 0 ? (
        <div className="bg-white border border-[#e0e0e0] rounded overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-[#f4f7fb]">
                <th className="text-left px-4 py-3 text-[11px] font-medium text-[#666666] uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-[#666666] uppercase tracking-wider">
                  Email
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-[#666666] uppercase tracking-wider">
                  Campaign
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-[#666666] uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-[#666666] uppercase tracking-wider">
                  Detail
                </th>
              </tr>
            </thead>
            <tbody>
              {logsData.logs.map((log) => (
                <tr key={log.id} className="border-t border-[#e8e8e8] hover:bg-[#f4f7fb] transition-colors">
                  <td className="px-4 py-3 text-xs text-[#888888]">
                    {format(new Date(log.sentAt), "MMM d, yyyy h:mm a")}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-[#1a3a5c]">{log.email}</td>
                  <td className="px-4 py-3 text-xs text-[#666666]">{log.campaignName || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          log.status === "sent" ? "bg-[#2d8a4e]" : "bg-[#c0392b]"
                        }`}
                      />
                      <span
                        className={`text-xs ${
                          log.status === "sent" ? "text-[#2d8a4e]" : "text-[#c0392b]"
                        }`}
                      >
                        {log.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#888888] max-w-[300px] truncate" title={log.detail || ""}>
                    {log.detail || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-[#e8e8e8]">
              <p className="text-xs text-[#888888]">
                Showing {(page - 1) * 50 + 1}-{Math.min(page * 50, logsData.total)} of {logsData.total} results
              </p>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="w-9 h-9 flex items-center justify-center border border-[#e0e0e0] rounded text-sm disabled:opacity-40 hover:bg-[#f4f7fb]"
                >
                  Prev
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const p = i + 1;
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-9 h-9 flex items-center justify-center border rounded text-sm ${
                        page === p
                          ? "bg-[#1a3a5c] text-white border-[#1a3a5c]"
                          : "border-[#e0e0e0] hover:bg-[#f4f7fb]"
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page >= totalPages}
                  className="w-9 h-9 flex items-center justify-center border border-[#e0e0e0] rounded text-sm disabled:opacity-40 hover:bg-[#f4f7fb]"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center py-16 bg-white border border-[#e0e0e0] rounded">
          <Mail className="w-12 h-12 text-[#888888]" />
          <h3 className="text-base font-semibold text-[#666666] mt-4">No logs yet</h3>
          <p className="text-sm text-[#888888] mt-1">
            Send a campaign to start generating logs.
          </p>
        </div>
      )}
    </div>
  );
}

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
