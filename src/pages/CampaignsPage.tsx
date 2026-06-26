import { useState } from "react";
import { trpc } from "@/providers/trpc";
import {
  Search,
  Plus,
  Play,
  Pause,
  Eye,import { useState } from "react";
import { trpc } from "@/providers/trpc";
import {
  Search,
  Plus,
  Play,
  Pause,
  Eye,
  Trash2,
  MailOpen,
} from "lucide-react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export default function CampaignsPage() {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState<number | null>(null);
  const [showDelete, setShowDelete] = useState<number | null>(null);

  // Create form state
  const [formName, setFormName] = useState("");
  const [formSubject, setFormSubject] = useState("");
  const [formTemplateId, setFormTemplateId] = useState("");
  const [formListId, setFormListId] = useState("");
  const [formDelay, setFormDelay] = useState("6");
  const [formLimit, setFormLimit] = useState("0");
  const [formTestEmail, setFormTestEmail] = useState("");

  const { data: campaignsData } = trpc.campaign.list.useQuery({
    page: 1,
    limit: 50,
    search: search || undefined,
    status: statusFilter !== "all" ? (statusFilter as "draft" | "sending" | "paused" | "completed" | "failed") : undefined,
  });

  const { data: templatesData } = trpc.template.list.useQuery({});
  const { data: listsData } = trpc.contactList.list.useQuery();
  const { data: detailData } = trpc.campaign.getById.useQuery(
    { id: showDetail! },
    { enabled: !!showDetail }
  );

  const createMutation = trpc.campaign.create.useMutation({
    onSuccess: () => {
      utils.campaign.list.invalidate();
      utils.dashboard.getStats.invalidate();
      setShowCreate(false);
      resetForm();
      toast.success("Campaign created successfully");
    },
    onError: (err) => toast.error(err.message),
  });

  const sendMutation = trpc.campaign.send.useMutation({
    onSuccess: () => {
      utils.campaign.list.invalidate();
      toast.success("Campaign started sending");
    },
    onError: (err) => toast.error(err.message),
  });

  const testMutation = trpc.campaign.test.useMutation({
    onSuccess: () => toast.success("Test email sent"),
    onError: (err) => toast.error(err.message),
  });

  const pauseMutation = trpc.campaign.pause.useMutation({
    onSuccess: () => {
      utils.campaign.list.invalidate();
      toast.success("Campaign paused");
    },
  });

  const resumeMutation = trpc.campaign.resume.useMutation({
    onSuccess: () => {
      utils.campaign.list.invalidate();
      toast.success("Campaign resumed");
    },
  });

  const deleteMutation = trpc.campaign.delete.useMutation({
    onSuccess: () => {
      utils.campaign.list.invalidate();
      utils.dashboard.getStats.invalidate();
      setShowDelete(null);
      toast.success("Campaign deleted");
    },
  });

  const resetForm = () => {
    setFormName("");
    setFormSubject("");
    setFormTemplateId("");
    setFormListId("");
    setFormDelay("6");
    setFormLimit("0");
    setFormTestEmail("");
  };

  const handleCreate = () => {
    if (!formName || !formSubject || !formTemplateId || !formListId) {
      toast.error("Please fill in all required fields");
      return;
    }
    createMutation.mutate({
      name: formName,
      subject: formSubject,
      templateId: Number(formTemplateId),
      listId: Number(formListId),
      delay: Number(formDelay) || 6,
      limit: Number(formLimit) || 0,
      testEmail: formTestEmail || undefined,
    });
  };

  const statusBadgeClass = (status: string) => {
    switch (status) {
      case "draft":
        return "bg-[#f4f7fb] border border-[#e0e0e0] text-[#666666]";
      case "sending":
        return "bg-[#c9a84c]/12 text-[#c9a84c]";
      case "paused":
        return "bg-[#e67e22]/12 text-[#e67e22]";
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
      {/* Header */}
      <p className="text-sm text-[#666666] -mt-2 mb-5">
        Create, manage, and send email campaigns to your contact lists.
      </p>

      {/* Actions */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#888888]" />
            <Input
              placeholder="Search campaigns..."
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
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sending">Sending</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          className="h-10 bg-[#c9a84c] hover:bg-[#d4b85c] text-[#222222] text-xs font-medium uppercase tracking-wider"
        >
          <Plus className="w-4 h-4 mr-1" /> New Campaign
        </Button>
      </div>

      {/* Campaigns Table */}
      {campaignsData?.campaigns && campaignsData.campaigns.length > 0 ? (
        <div className="bg-white border border-[#e0e0e0] rounded overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-[#f4f7fb]">
                <th className="text-left px-4 py-3 text-[11px] font-medium text-[#666666] uppercase tracking-wider">
                  Campaign
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-[#666666] uppercase tracking-wider">
                  Subject
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-[#666666] uppercase tracking-wider">
                  Recipients
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-[#666666] uppercase tracking-wider">
                  Progress
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-[#666666] uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-[#666666] uppercase tracking-wider">
                  Created
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-[#666666] uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {campaignsData.campaigns.map((c) => (
                <tr
                  key={c.id}
                  className="border-t border-[#e8e8e8] hover:bg-[#f4f7fb] transition-colors"
                >
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-[#1a3a5c]">{c.name}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#666666] max-w-[200px] truncate">
                    {c.subject}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#666666]">{c.totalRecipients}</td>
                  <td className="px-4 py-3">
                    <div className="w-full">
                      <div className="h-1.5 bg-[#e8e8e8] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#c9a84c] rounded-full transition-all"
                          style={{
                            width: `${c.totalRecipients > 0 ? (c.sentCount / c.totalRecipients) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <span className="text-[11px] text-[#888888] mt-0.5 block">
                        {c.sentCount}/{c.totalRecipients}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2.5 py-0.5 text-xs rounded-full ${statusBadgeClass(c.status)}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#888888]">
                    {format(new Date(c.createdAt), "MMM d, yyyy")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {c.status === "draft" && (
                        <button
                          onClick={() => sendMutation.mutate({ id: c.id })}
                          className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#f4f7fb] text-[#1a3a5c]"
                          title="Send"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                      {c.status === "sending" && (
                        <button
                          onClick={() => pauseMutation.mutate({ id: c.id })}
                          className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#f4f7fb] text-[#e67e22]"
                          title="Pause"
                        >
                          <Pause className="w-4 h-4" />
                        </button>
                      )}
                      {c.status === "paused" && (
                        <button
                          onClick={() => resumeMutation.mutate({ id: c.id })}
                          className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#f4f7fb] text-[#1a3a5c]"
                          title="Resume"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => setShowDetail(c.id)}
                        className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#f4f7fb] text-[#666666]"
                        title="View"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setShowDelete(c.id)}
                        className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#f4f7fb] text-[#666666] hover:text-[#c0392b]"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col items-center py-16 bg-white border border-[#e0e0e0] rounded">
          <MailOpen className="w-12 h-12 text-[#888888]" />
          <h3 className="text-base font-semibold text-[#666666] mt-4">No campaigns found</h3>
          <p className="text-sm text-[#888888] mt-1">
            Create a campaign to start sending emails.
          </p>
          <Button
            onClick={() => setShowCreate(true)}
            className="mt-4 h-10 bg-[#c9a84c] hover:bg-[#d4b85c] text-[#222222]"
          >
            <Plus className="w-4 h-4 mr-1" /> Create Campaign
          </Button>
        </div>
      )}

      {/* Create Campaign Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-[#222222]">
              Create Campaign
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-xs uppercase tracking-wider text-[#666666]">
                Campaign Name *
              </Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Summer Outreach"
                className="mt-1 h-10 border-[#e0e0e0]"
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-[#666666]">
                Subject Line *
              </Label>
              <Input
                value={formSubject}
                onChange={(e) => setFormSubject(e.target.value)}
                placeholder="Hello {{first_name}}"
                className="mt-1 h-10 border-[#e0e0e0]"
              />
              <p className="text-xs text-[#888888] mt-1">
                Use {"{{first_name}}"}, {"{{email}}"} for personalization
              </p>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-[#666666]">
                Template *
              </Label>
              <Select value={formTemplateId} onValueChange={setFormTemplateId}>
                <SelectTrigger className="mt-1 h-10 border-[#e0e0e0]">
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {templatesData?.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-[#666666]">
                Contact List *
              </Label>
              <Select value={formListId} onValueChange={setFormListId}>
                <SelectTrigger className="mt-1 h-10 border-[#e0e0e0]">
                  <SelectValue placeholder="Select a list" />
                </SelectTrigger>
                <SelectContent>
                  {listsData?.map((l) => (
                    <SelectItem key={l.id} value={String(l.id)}>
                      {l.name} ({l.contactCount} contacts)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs uppercase tracking-wider text-[#666666]">
                  Delay (seconds)
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={300}
                  value={formDelay}
                  onChange={(e) => setFormDelay(e.target.value)}
                  className="mt-1 h-10 border-[#e0e0e0]"
                />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-[#666666]">
                  Daily Limit (0 = none)
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={formLimit}
                  onChange={(e) => setFormLimit(e.target.value)}
                  className="mt-1 h-10 border-[#e0e0e0]"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-[#666666]">
                Test Email
              </Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={formTestEmail}
                  onChange={(e) => setFormTestEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="h-10 border-[#e0e0e0] flex-1"
                />
                <Button
                  variant="outline"
                  className="h-10 border-[#e0e0e0]"
                  onClick={() => {
                    if (!formTestEmail) {
                      toast.error("Enter a test email address");
                      return;
                    }
                    // Create then test
                    handleCreate();
                  }}
                  disabled={testMutation.isPending}
                >
                  Send Test
                </Button>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreate(false);
                  resetForm();
                }}
                className="h-10 border-[#e0e0e0]"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={createMutation.isPending}
                className="h-10 bg-[#1a3a5c] hover:bg-[#2a4a6c] text-white text-xs font-medium uppercase tracking-wider"
              >
                {createMutation.isPending ? "Creating..." : "Create Campaign"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Campaign Detail Dialog */}
      <Dialog open={!!showDetail} onOpenChange={() => setShowDetail(null)}>
        <DialogContent className="max-w-[720px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-[#222222]">
              {detailData?.name || "Campaign Details"}
            </DialogTitle>
          </DialogHeader>
          {detailData && (
            <div className="space-y-4 pt-2">
              {/* Stats */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Recipients", value: detailData.totalRecipients },
                  { label: "Sent", value: detailData.sentCount, color: "text-[#2d8a4e]" },
                  { label: "Failed", value: detailData.failedCount, color: "text-[#c0392b]" },
                  {
                    label: "Remaining",
                    value: detailData.totalRecipients - detailData.sentCount - detailData.failedCount,
                  },
                ].map((s) => (
                  <div key={s.label} className="bg-[#f4f7fb] rounded p-3 text-center">
                    <p className={`text-2xl font-bold ${s.color || "text-[#1a3a5c]"}`}>{s.value}</p>
                    <p className="text-[11px] text-[#666666] uppercase tracking-wider">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Progress */}
              <div>
                <div className="h-2 bg-[#e8e8e8] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#c9a84c] rounded-full transition-all"
                    style={{
                      width: `${detailData.totalRecipients > 0 ? (detailData.sentCount / detailData.totalRecipients) * 100 : 0}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-[#888888] mt-1">
                  {detailData.sentCount} of {detailData.totalRecipients} sent
                </p>
              </div>

              {/* Subject */}
              <div>
                <Label className="text-xs uppercase tracking-wider text-[#666666]">Subject</Label>
                <p className="text-sm text-[#222222] mt-1">{detailData.subject}</p>
              </div>

              {/* Template */}
              <div>
                <Label className="text-xs uppercase tracking-wider text-[#666666]">Template</Label>
                <p className="text-sm text-[#1a3a5c] mt-1">{detailData.templateName || "N/A"}</p>
              </div>

              {/* Recent Logs */}
              <div>
                <Label className="text-xs uppercase tracking-wider text-[#666666]">Recent Activity</Label>
                <div className="mt-1 max-h-[200px] overflow-y-auto border border-[#e8e8e8] rounded">
                  {detailData.recentLogs?.length ? (
                    detailData.recentLogs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-start justify-between gap-3 px-3 py-2 text-xs border-b border-[#e8e8e8] last:border-0"
                      >
                        <div className="min-w-0">
                          <span className="text-[#1a3a5c]">{log.email}</span>
                          {log.status === "failed" && log.detail && (
                            <p className="text-[11px] text-[#c0392b] mt-0.5 break-words">
                              {log.detail}
                            </p>
                          )}
                        </div>
                        <span
                          className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] ${
                            log.status === "sent"
                              ? "bg-[#2d8a4e]/12 text-[#2d8a4e]"
                              : "bg-[#c0392b]/12 text-[#c0392b]"
                          }`}
                        >
                          {log.status}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="px-3 py-2 text-xs text-[#888888]">No activity yet</p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                {detailData.status === "draft" && (
                  <Button
                    onClick={() => sendMutation.mutate({ id: detailData.id })}
                    className="h-10 bg-[#c9a84c] hover:bg-[#d4b85c] text-[#222222]"
                  >
                    <Play className="w-4 h-4 mr-1" /> Send Campaign
                  </Button>
                )}
                {detailData.status === "sending" && (
                  <Button
                    onClick={() => pauseMutation.mutate({ id: detailData.id })}
                    variant="outline"
                    className="h-10 border-[#e67e22] text-[#e67e22]"
                  >
                    <Pause className="w-4 h-4 mr-1" /> Pause
                  </Button>
                )}
                {detailData.status === "paused" && (
                  <Button
                    onClick={() => resumeMutation.mutate({ id: detailData.id })}
                    className="h-10 bg-[#c9a84c] hover:bg-[#d4b85c] text-[#222222]"
                  >
                    <Play className="w-4 h-4 mr-1" /> Resume
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!showDelete} onOpenChange={() => setShowDelete(null)}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-[#222222]">
              Delete Campaign?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[#666666]">
            This campaign and all its send logs will be permanently removed.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setShowDelete(null)}
              className="h-10 border-[#e0e0e0]"
            >
              Cancel
            </Button>
            <Button
              onClick={() => showDelete && deleteMutation.mutate({ id: showDelete })}
              disabled={deleteMutation.isPending}
              className="h-10 bg-[#c0392b] hover:bg-[#a93226] text-white"
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
  Trash2,
  MailOpen,
} from "lucide-react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export default function CampaignsPage() {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState<number | null>(null);
  const [showDelete, setShowDelete] = useState<number | null>(null);

  // Create form state
  const [formName, setFormName] = useState("");
  const [formSubject, setFormSubject] = useState("");
  const [formTemplateId, setFormTemplateId] = useState("");
  const [formListId, setFormListId] = useState("");
  const [formDelay, setFormDelay] = useState("6");
  const [formLimit, setFormLimit] = useState("0");
  const [formTestEmail, setFormTestEmail] = useState("");

  const { data: campaignsData } = trpc.campaign.list.useQuery({
    page: 1,
    limit: 50,
    search: search || undefined,
    status: statusFilter !== "all" ? (statusFilter as "draft" | "sending" | "paused" | "completed" | "failed") : undefined,
  });

  const { data: templatesData } = trpc.template.list.useQuery({});
  const { data: listsData } = trpc.contactList.list.useQuery();
  const { data: detailData } = trpc.campaign.getById.useQuery(
    { id: showDetail! },
    { enabled: !!showDetail }
  );

  const createMutation = trpc.campaign.create.useMutation({
    onSuccess: () => {
      utils.campaign.list.invalidate();
      utils.dashboard.getStats.invalidate();
      setShowCreate(false);
      resetForm();
      toast.success("Campaign created successfully");
    },
    onError: (err) => toast.error(err.message),
  });

  const sendMutation = trpc.campaign.send.useMutation({
    onSuccess: () => {
      utils.campaign.list.invalidate();
      toast.success("Campaign started sending");
    },
    onError: (err) => toast.error(err.message),
  });

  const testMutation = trpc.campaign.test.useMutation({
    onSuccess: () => toast.success("Test email sent"),
    onError: (err) => toast.error(err.message),
  });

  const pauseMutation = trpc.campaign.pause.useMutation({
    onSuccess: () => {
      utils.campaign.list.invalidate();
      toast.success("Campaign paused");
    },
  });

  const resumeMutation = trpc.campaign.resume.useMutation({
    onSuccess: () => {
      utils.campaign.list.invalidate();
      toast.success("Campaign resumed");
    },
  });

  const deleteMutation = trpc.campaign.delete.useMutation({
    onSuccess: () => {
      utils.campaign.list.invalidate();
      utils.dashboard.getStats.invalidate();
      setShowDelete(null);
      toast.success("Campaign deleted");
    },
  });

  const resetForm = () => {
    setFormName("");
    setFormSubject("");
    setFormTemplateId("");
    setFormListId("");
    setFormDelay("6");
    setFormLimit("0");
    setFormTestEmail("");
  };

  const handleCreate = () => {
    if (!formName || !formSubject || !formTemplateId || !formListId) {
      toast.error("Please fill in all required fields");
      return;
    }
    createMutation.mutate({
      name: formName,
      subject: formSubject,
      templateId: Number(formTemplateId),
      listId: Number(formListId),
      delay: Number(formDelay) || 6,
      limit: Number(formLimit) || 0,
      testEmail: formTestEmail || undefined,
    });
  };

  const statusBadgeClass = (status: string) => {
    switch (status) {
      case "draft":
        return "bg-[#f4f7fb] border border-[#e0e0e0] text-[#666666]";
      case "sending":
        return "bg-[#c9a84c]/12 text-[#c9a84c]";
      case "paused":
        return "bg-[#e67e22]/12 text-[#e67e22]";
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
      {/* Header */}
      <p className="text-sm text-[#666666] -mt-2 mb-5">
        Create, manage, and send email campaigns to your contact lists.
      </p>

      {/* Actions */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#888888]" />
            <Input
              placeholder="Search campaigns..."
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
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sending">Sending</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          className="h-10 bg-[#c9a84c] hover:bg-[#d4b85c] text-[#222222] text-xs font-medium uppercase tracking-wider"
        >
          <Plus className="w-4 h-4 mr-1" /> New Campaign
        </Button>
      </div>

      {/* Campaigns Table */}
      {campaignsData?.campaigns && campaignsData.campaigns.length > 0 ? (
        <div className="bg-white border border-[#e0e0e0] rounded overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-[#f4f7fb]">
                <th className="text-left px-4 py-3 text-[11px] font-medium text-[#666666] uppercase tracking-wider">
                  Campaign
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-[#666666] uppercase tracking-wider">
                  Subject
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-[#666666] uppercase tracking-wider">
                  Recipients
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-[#666666] uppercase tracking-wider">
                  Progress
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-[#666666] uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-[#666666] uppercase tracking-wider">
                  Created
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-[#666666] uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {campaignsData.campaigns.map((c) => (
                <tr
                  key={c.id}
                  className="border-t border-[#e8e8e8] hover:bg-[#f4f7fb] transition-colors"
                >
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-[#1a3a5c]">{c.name}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#666666] max-w-[200px] truncate">
                    {c.subject}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#666666]">{c.totalRecipients}</td>
                  <td className="px-4 py-3">
                    <div className="w-full">
                      <div className="h-1.5 bg-[#e8e8e8] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#c9a84c] rounded-full transition-all"
                          style={{
                            width: `${c.totalRecipients > 0 ? (c.sentCount / c.totalRecipients) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <span className="text-[11px] text-[#888888] mt-0.5 block">
                        {c.sentCount}/{c.totalRecipients}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2.5 py-0.5 text-xs rounded-full ${statusBadgeClass(c.status)}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#888888]">
                    {format(new Date(c.createdAt), "MMM d, yyyy")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {c.status === "draft" && (
                        <button
                          onClick={() => sendMutation.mutate({ id: c.id })}
                          className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#f4f7fb] text-[#1a3a5c]"
                          title="Send"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                      {c.status === "sending" && (
                        <button
                          onClick={() => pauseMutation.mutate({ id: c.id })}
                          className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#f4f7fb] text-[#e67e22]"
                          title="Pause"
                        >
                          <Pause className="w-4 h-4" />
                        </button>
                      )}
                      {c.status === "paused" && (
                        <button
                          onClick={() => resumeMutation.mutate({ id: c.id })}
                          className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#f4f7fb] text-[#1a3a5c]"
                          title="Resume"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => setShowDetail(c.id)}
                        className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#f4f7fb] text-[#666666]"
                        title="View"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setShowDelete(c.id)}
                        className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#f4f7fb] text-[#666666] hover:text-[#c0392b]"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col items-center py-16 bg-white border border-[#e0e0e0] rounded">
          <MailOpen className="w-12 h-12 text-[#888888]" />
          <h3 className="text-base font-semibold text-[#666666] mt-4">No campaigns found</h3>
          <p className="text-sm text-[#888888] mt-1">
            Create a campaign to start sending emails.
          </p>
          <Button
            onClick={() => setShowCreate(true)}
            className="mt-4 h-10 bg-[#c9a84c] hover:bg-[#d4b85c] text-[#222222]"
          >
            <Plus className="w-4 h-4 mr-1" /> Create Campaign
          </Button>
        </div>
      )}

      {/* Create Campaign Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-[#222222]">
              Create Campaign
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-xs uppercase tracking-wider text-[#666666]">
                Campaign Name *
              </Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Summer Outreach"
                className="mt-1 h-10 border-[#e0e0e0]"
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-[#666666]">
                Subject Line *
              </Label>
              <Input
                value={formSubject}
                onChange={(e) => setFormSubject(e.target.value)}
                placeholder="Hello {{first_name}}"
                className="mt-1 h-10 border-[#e0e0e0]"
              />
              <p className="text-xs text-[#888888] mt-1">
                Use {"{{first_name}}"}, {"{{email}}"} for personalization
              </p>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-[#666666]">
                Template *
              </Label>
              <Select value={formTemplateId} onValueChange={setFormTemplateId}>
                <SelectTrigger className="mt-1 h-10 border-[#e0e0e0]">
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {templatesData?.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-[#666666]">
                Contact List *
              </Label>
              <Select value={formListId} onValueChange={setFormListId}>
                <SelectTrigger className="mt-1 h-10 border-[#e0e0e0]">
                  <SelectValue placeholder="Select a list" />
                </SelectTrigger>
                <SelectContent>
                  {listsData?.map((l) => (
                    <SelectItem key={l.id} value={String(l.id)}>
                      {l.name} ({l.contactCount} contacts)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs uppercase tracking-wider text-[#666666]">
                  Delay (seconds)
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={300}
                  value={formDelay}
                  onChange={(e) => setFormDelay(e.target.value)}
                  className="mt-1 h-10 border-[#e0e0e0]"
                />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-[#666666]">
                  Daily Limit (0 = none)
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={formLimit}
                  onChange={(e) => setFormLimit(e.target.value)}
                  className="mt-1 h-10 border-[#e0e0e0]"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-[#666666]">
                Test Email
              </Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={formTestEmail}
                  onChange={(e) => setFormTestEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="h-10 border-[#e0e0e0] flex-1"
                />
                <Button
                  variant="outline"
                  className="h-10 border-[#e0e0e0]"
                  onClick={() => {
                    if (!formTestEmail) {
                      toast.error("Enter a test email address");
                      return;
                    }
                    // Create then test
                    handleCreate();
                  }}
                  disabled={testMutation.isPending}
                >
                  Send Test
                </Button>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreate(false);
                  resetForm();
                }}
                className="h-10 border-[#e0e0e0]"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={createMutation.isPending}
                className="h-10 bg-[#1a3a5c] hover:bg-[#2a4a6c] text-white text-xs font-medium uppercase tracking-wider"
              >
                {createMutation.isPending ? "Creating..." : "Create Campaign"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Campaign Detail Dialog */}
      <Dialog open={!!showDetail} onOpenChange={() => setShowDetail(null)}>
        <DialogContent className="max-w-[720px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-[#222222]">
              {detailData?.name || "Campaign Details"}
            </DialogTitle>
          </DialogHeader>
          {detailData && (
            <div className="space-y-4 pt-2">
              {/* Stats */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Recipients", value: detailData.totalRecipients },
                  { label: "Sent", value: detailData.sentCount, color: "text-[#2d8a4e]" },
                  { label: "Failed", value: detailData.failedCount, color: "text-[#c0392b]" },
                  {
                    label: "Remaining",
                    value: detailData.totalRecipients - detailData.sentCount - detailData.failedCount,
                  },
                ].map((s) => (
                  <div key={s.label} className="bg-[#f4f7fb] rounded p-3 text-center">
                    <p className={`text-2xl font-bold ${s.color || "text-[#1a3a5c]"}`}>{s.value}</p>
                    <p className="text-[11px] text-[#666666] uppercase tracking-wider">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Progress */}
              <div>
                <div className="h-2 bg-[#e8e8e8] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#c9a84c] rounded-full transition-all"
                    style={{
                      width: `${detailData.totalRecipients > 0 ? (detailData.sentCount / detailData.totalRecipients) * 100 : 0}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-[#888888] mt-1">
                  {detailData.sentCount} of {detailData.totalRecipients} sent
                </p>
              </div>

              {/* Subject */}
              <div>
                <Label className="text-xs uppercase tracking-wider text-[#666666]">Subject</Label>
                <p className="text-sm text-[#222222] mt-1">{detailData.subject}</p>
              </div>

              {/* Template */}
              <div>
                <Label className="text-xs uppercase tracking-wider text-[#666666]">Template</Label>
                <p className="text-sm text-[#1a3a5c] mt-1">{detailData.templateName || "N/A"}</p>
              </div>

              {/* Recent Logs */}
              <div>
                <Label className="text-xs uppercase tracking-wider text-[#666666]">Recent Activity</Label>
                <div className="mt-1 max-h-[200px] overflow-y-auto border border-[#e8e8e8] rounded">
                  {detailData.recentLogs?.length ? (
                    detailData.recentLogs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between px-3 py-2 text-xs border-b border-[#e8e8e8] last:border-0"
                      >
                        <span className="text-[#1a3a5c]">{log.email}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] ${
                            log.status === "sent"
                              ? "bg-[#2d8a4e]/12 text-[#2d8a4e]"
                              : "bg-[#c0392b]/12 text-[#c0392b]"
                          }`}
                        >
                          {log.status}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="px-3 py-2 text-xs text-[#888888]">No activity yet</p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                {detailData.status === "draft" && (
                  <Button
                    onClick={() => sendMutation.mutate({ id: detailData.id })}
                    className="h-10 bg-[#c9a84c] hover:bg-[#d4b85c] text-[#222222]"
                  >
                    <Play className="w-4 h-4 mr-1" /> Send Campaign
                  </Button>
                )}
                {detailData.status === "sending" && (
                  <Button
                    onClick={() => pauseMutation.mutate({ id: detailData.id })}
                    variant="outline"
                    className="h-10 border-[#e67e22] text-[#e67e22]"
                  >
                    <Pause className="w-4 h-4 mr-1" /> Pause
                  </Button>
                )}
                {detailData.status === "paused" && (
                  <Button
                    onClick={() => resumeMutation.mutate({ id: detailData.id })}
                    className="h-10 bg-[#c9a84c] hover:bg-[#d4b85c] text-[#222222]"
                  >
                    <Play className="w-4 h-4 mr-1" /> Resume
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!showDelete} onOpenChange={() => setShowDelete(null)}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-[#222222]">
              Delete Campaign?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[#666666]">
            This campaign and all its send logs will be permanently removed.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setShowDelete(null)}
              className="h-10 border-[#e0e0e0]"
            >
              Cancel
            </Button>
            <Button
              onClick={() => showDelete && deleteMutation.mutate({ id: showDelete })}
              disabled={deleteMutation.isPending}
              className="h-10 bg-[#c0392b] hover:bg-[#a93226] text-white"
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
